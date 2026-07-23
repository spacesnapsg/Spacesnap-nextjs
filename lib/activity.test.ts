// Coverage for the activity feed's pagination/date-range rewrite
// (2026-07-23) — replaced the old flat limit-capped-at-200 feed with real
// page/pageSize paging and explicit from/to date filtering (see the dated
// comment on parseActivityQuery, lib/activity.ts). Hits the real dev/test
// Postgres DB through Prisma, same convention as lib/company-membership.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { parseActivityQuery, getUserActivity } from "./activity";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Activity Test User",
      email: `activity-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

async function cleanupUser(userId: string) {
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe("parseActivityQuery", () => {
  test("defaults: page 1, pageSize 10, no filters", () => {
    const query = parseActivityQuery(new URLSearchParams());
    assert.deepEqual(query, { types: null, from: null, to: null, page: 1, pageSize: 10 });
  });

  test("accepts page/pageSize, caps pageSize at 50", () => {
    const query = parseActivityQuery(new URLSearchParams("page=3&pageSize=200"));
    assert.equal(query.page, 3);
    assert.equal(query.pageSize, 50);
  });

  test("rejects a non-positive page", () => {
    assert.throws(() => parseActivityQuery(new URLSearchParams("page=0")), ApiValidationError);
  });

  test("rejects a non-positive pageSize", () => {
    assert.throws(() => parseActivityQuery(new URLSearchParams("pageSize=-5")), ApiValidationError);
  });

  test("parses from/to as dates", () => {
    const query = parseActivityQuery(new URLSearchParams("from=2026-01-01&to=2026-01-31"));
    assert.ok(query.from instanceof Date);
    assert.ok(query.to instanceof Date);
  });

  test("to is inclusive of the whole day (set to 23:59:59.999)", () => {
    const query = parseActivityQuery(new URLSearchParams("to=2026-01-31"));
    assert.equal(query.to?.getHours(), 23);
    assert.equal(query.to?.getMinutes(), 59);
  });

  test("rejects an invalid from date", () => {
    assert.throws(() => parseActivityQuery(new URLSearchParams("from=not-a-date")), ApiValidationError);
  });

  test("rejects from after to", () => {
    assert.throws(() => parseActivityQuery(new URLSearchParams("from=2026-02-01&to=2026-01-01")), ApiValidationError);
  });

  test("rejects an unknown activity type", () => {
    assert.throws(() => parseActivityQuery(new URLSearchParams("types=not_a_real_type")), ApiValidationError);
  });
});

describe("getUserActivity (real DB)", () => {
  test("pages through results 10 at a time, newest first, with an accurate total", async () => {
    const user = await createUser();
    try {
      // 25 rows, 1 minute apart, oldest first so index 0 is the oldest.
      const base = new Date("2026-01-01T00:00:00.000Z");
      for (let i = 0; i < 25; i++) {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            actionType: "wallet_topup",
            description: `Row ${i}`,
            createdAt: new Date(base.getTime() + i * 60_000),
          },
        });
      }

      const page1 = await getUserActivity(user.id, { types: null, from: null, to: null, page: 1, pageSize: 10 });
      assert.equal(page1.total, 25);
      assert.equal(page1.items.length, 10);
      assert.equal(page1.items[0].description, "Row 24"); // newest first

      const page3 = await getUserActivity(user.id, { types: null, from: null, to: null, page: 3, pageSize: 10 });
      assert.equal(page3.items.length, 5); // 25 - 20 remaining
      assert.equal(page3.items[0].description, "Row 4");

      const page4 = await getUserActivity(user.id, { types: null, from: null, to: null, page: 4, pageSize: 10 });
      assert.equal(page4.items.length, 0);
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("from/to filters by createdAt range", async () => {
    const user = await createUser();
    try {
      await prisma.activityLog.create({
        data: { userId: user.id, actionType: "wallet_topup", description: "Too early", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      });
      await prisma.activityLog.create({
        data: { userId: user.id, actionType: "wallet_topup", description: "In range", createdAt: new Date("2026-01-15T00:00:00.000Z") },
      });
      await prisma.activityLog.create({
        data: { userId: user.id, actionType: "wallet_topup", description: "Too late", createdAt: new Date("2026-02-01T00:00:00.000Z") },
      });

      const result = await getUserActivity(user.id, {
        types: null,
        from: new Date("2026-01-10T00:00:00.000Z"),
        to: new Date("2026-01-20T00:00:00.000Z"),
        page: 1,
        pageSize: 10,
      });

      assert.equal(result.total, 1);
      assert.equal(result.items[0].description, "In range");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("types filters to only the requested action types", async () => {
    const user = await createUser();
    try {
      await prisma.activityLog.create({
        data: { userId: user.id, actionType: "wallet_topup", description: "Topup" },
      });
      await prisma.activityLog.create({
        data: { userId: user.id, actionType: "check_in", description: "Check-in" },
      });

      const result = await getUserActivity(user.id, {
        types: ["wallet_topup"],
        from: null,
        to: null,
        page: 1,
        pageSize: 10,
      });

      assert.equal(result.total, 1);
      assert.equal(result.items[0].description, "Topup");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("never returns another user's rows", async () => {
    const userA = await createUser();
    const userB = await createUser();
    try {
      await prisma.activityLog.create({
        data: { userId: userA.id, actionType: "wallet_topup", description: "A's row" },
      });
      await prisma.activityLog.create({
        data: { userId: userB.id, actionType: "wallet_topup", description: "B's row" },
      });

      const result = await getUserActivity(userA.id, { types: null, from: null, to: null, page: 1, pageSize: 10 });
      assert.equal(result.total, 1);
      assert.equal(result.items[0].description, "A's row");
    } finally {
      await cleanupUser(userA.id);
      await cleanupUser(userB.id);
    }
  });
});
