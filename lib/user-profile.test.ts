// Coverage for lib/user-profile.ts — backs the Digital Passport and Supplier
// Profile "Edit Profile" cards, previously fake-saving local-only edits with
// no backend at all (2026-07-24 pre-UAT audit finding). Hits the real
// dev/test Postgres DB through Prisma, same convention as
// lib/company-membership.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { ApiValidationError } from "./api-errors";
import { updateUserProfile } from "./user-profile";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Profile Test User",
      email: `user-profile-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
      title: "Original Title",
    },
  });
}

async function cleanupUsers(userIds: string[]) {
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
}

describe("updateUserProfile (real DB)", () => {
  test("updates name/title/avatarUrl", async () => {
    const user = await createUser();
    try {
      const updated = await updateUserProfile(user.id, {
        name: "  New Name  ",
        title: "  New Title  ",
        avatarUrl: "data:image/png;base64,abc123",
      });
      assert.equal(updated.name, "New Name");
      assert.equal(updated.title, "New Title");
      assert.equal(updated.avatarUrl, "data:image/png;base64,abc123");
    } finally {
      await cleanupUsers([user.id]);
    }
  });

  test("blank title/avatarUrl clear those fields", async () => {
    const user = await createUser();
    try {
      const updated = await updateUserProfile(user.id, { name: "Kept Name", title: "  ", avatarUrl: null });
      assert.equal(updated.title, null);
      assert.equal(updated.avatarUrl, null);
    } finally {
      await cleanupUsers([user.id]);
    }
  });

  test("rejects a blank name", async () => {
    const user = await createUser();
    try {
      await assert.rejects(
        () => updateUserProfile(user.id, { name: "   ", title: null, avatarUrl: null }),
        ApiValidationError
      );
    } finally {
      await cleanupUsers([user.id]);
    }
  });
});
