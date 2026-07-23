// Coverage for the wallet's paginated "Recent Transactions" feed
// (2026-07-23) — split out of GET /api/wallet's flat take-50 list, same
// pagination/date-range treatment as lib/activity.ts. Hits the real
// dev/test Postgres DB through Prisma, same convention as lib/wallet.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType } from "../app/generated/prisma/client";
import { getWalletTransactionsPage } from "./wallet-transactions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Wallet Transactions Test User",
      email: `wallet-tx-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

async function cleanupUser(userId: string) {
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe("getWalletTransactionsPage (real DB)", () => {
  test("pages through results 10 at a time, newest first, with an accurate total", async () => {
    const user = await createUser();
    try {
      const base = new Date("2026-01-01T00:00:00.000Z");
      for (let i = 0; i < 15; i++) {
        await prisma.transaction.create({
          data: {
            userId: user.id,
            type: TransactionType.topup,
            amount: "10.00",
            description: `Row ${i}`,
            createdAt: new Date(base.getTime() + i * 60_000),
          },
        });
      }

      const page1 = await getWalletTransactionsPage(user.id, { types: null, from: null, to: null, page: 1, pageSize: 10 });
      assert.equal(page1.total, 15);
      assert.equal(page1.items.length, 10);
      assert.equal(page1.items[0].description, "Row 14");

      const page2 = await getWalletTransactionsPage(user.id, { types: null, from: null, to: null, page: 2, pageSize: 10 });
      assert.equal(page2.items.length, 5);
      assert.equal(page2.items[0].description, "Row 4");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("from/to filters by createdAt range", async () => {
    const user = await createUser();
    try {
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "10.00", description: "Too early", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "10.00", description: "In range", createdAt: new Date("2026-01-15T00:00:00.000Z") },
      });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "10.00", description: "Too late", createdAt: new Date("2026-02-01T00:00:00.000Z") },
      });

      const result = await getWalletTransactionsPage(user.id, {
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

  test("never returns another user's rows", async () => {
    const userA = await createUser();
    const userB = await createUser();
    try {
      await prisma.transaction.create({
        data: { userId: userA.id, type: TransactionType.topup, amount: "10.00", description: "A's row" },
      });
      await prisma.transaction.create({
        data: { userId: userB.id, type: TransactionType.topup, amount: "10.00", description: "B's row" },
      });

      const result = await getWalletTransactionsPage(userA.id, { types: null, from: null, to: null, page: 1, pageSize: 10 });
      assert.equal(result.total, 1);
      assert.equal(result.items[0].description, "A's row");
    } finally {
      await cleanupUser(userA.id);
      await cleanupUser(userB.id);
    }
  });
});
