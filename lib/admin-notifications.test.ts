// Coverage for the admin-facing "what happened on the platform" feed
// (2026-07-27) — creation, active/archived filtering, pagination, and the
// mark-read/archive toggles. Hits the real test DB through Prisma, same
// convention as the rest of this project's lib/*.test.ts files. The four
// real trigger points (new_user/new_supplier/new_booking/new_credential) are
// covered where they actually fire — app/api/auth/register, lib/company-
// membership.test.ts, lib/bookings.test.ts, lib/training-credentials.test.ts
// — this file only tests the shared list/read/archive machinery in isolation.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AdminNotificationType } from "../app/generated/prisma/client";
import {
  createAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  setAdminNotificationArchived,
  markAllAdminNotificationsRead,
  archiveAllAdminNotifications,
  AdminNotificationNotFoundError,
} from "./admin-notifications";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let n = 0;
async function seed(overrides: Partial<{ isRead: boolean; isArchived: boolean; title: string }> = {}) {
  n += 1;
  const notification = await prisma.adminNotification.create({
    data: {
      type: AdminNotificationType.new_user,
      title: overrides.title ?? `Test Notification ${n}`,
      message: "Test message.",
      isRead: overrides.isRead ?? false,
      isArchived: overrides.isArchived ?? false,
    },
  });
  return notification;
}

async function cleanup(ids: bigint[]) {
  await prisma.adminNotification.deleteMany({ where: { id: { in: ids } } });
}

describe("createAdminNotification", () => {
  test("creates a row with the given fields, related ids default to null", async () => {
    const user = await prisma.user.create({
      data: { name: "Admin Notif Test User", email: `admin-notif-test-${Date.now()}@example.com`, password: "x" },
    });
    try {
      await createAdminNotification(prisma, {
        type: AdminNotificationType.new_user,
        title: "New account created",
        message: `${user.name} signed up.`,
        relatedUserId: user.id,
      });

      const rows = await prisma.adminNotification.findMany({ where: { relatedUserId: user.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].type, "new_user");
      assert.equal(rows[0].isRead, false);
      assert.equal(rows[0].isArchived, false);
      assert.equal(rows[0].relatedCompanyId, null);
      await cleanup([rows[0].id]);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

describe("getAdminNotifications — active/archived filter + pagination", () => {
  test("status=active excludes archived rows; status=archived returns only archived rows", async () => {
    const active = await seed({ isArchived: false });
    const archived = await seed({ isArchived: true });
    try {
      const activeResult = await getAdminNotifications({ status: "active" });
      assert.ok(activeResult.notifications.some((n) => n.id === active.id.toString()));
      assert.ok(!activeResult.notifications.some((n) => n.id === archived.id.toString()));

      const archivedResult = await getAdminNotifications({ status: "archived" });
      assert.ok(archivedResult.notifications.some((n) => n.id === archived.id.toString()));
      assert.ok(!archivedResult.notifications.some((n) => n.id === active.id.toString()));
    } finally {
      await cleanup([active.id, archived.id]);
    }
  });

  test("paginates 10/page, newest first, with an accurate total", async () => {
    const rows = [];
    for (let i = 0; i < 12; i++) {
      rows.push(await seed({ title: `Pagination Test ${Date.now()}-${i}` }));
    }
    try {
      const page1 = await getAdminNotifications({ status: "active", page: 1 });
      assert.equal(page1.meta.perPage, 10);
      assert.ok(page1.meta.total >= 12);
      assert.equal(page1.notifications.length, 10);

      // Newest-first: the very last row seeded should be first on page 1.
      assert.equal(page1.notifications[0].id, rows[rows.length - 1].id.toString());

      const page2 = await getAdminNotifications({ status: "active", page: 2 });
      assert.equal(page2.meta.page, 2);
      // No overlap between the two pages.
      const page1Ids = new Set(page1.notifications.map((n) => n.id));
      assert.ok(page2.notifications.every((n) => !page1Ids.has(n.id)));
    } finally {
      await cleanup(rows.map((r) => r.id));
    }
  });
});

describe("markAdminNotificationRead / setAdminNotificationArchived", () => {
  test("toggles isRead both ways", async () => {
    const row = await seed({ isRead: false });
    try {
      await markAdminNotificationRead(row.id, true);
      let updated = await prisma.adminNotification.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(updated.isRead, true);

      await markAdminNotificationRead(row.id, false);
      updated = await prisma.adminNotification.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(updated.isRead, false);
    } finally {
      await cleanup([row.id]);
    }
  });

  test("toggles isArchived both ways (archive, then restore)", async () => {
    const row = await seed({ isArchived: false });
    try {
      await setAdminNotificationArchived(row.id, true);
      let updated = await prisma.adminNotification.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(updated.isArchived, true);

      await setAdminNotificationArchived(row.id, false);
      updated = await prisma.adminNotification.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(updated.isArchived, false);
    } finally {
      await cleanup([row.id]);
    }
  });

  test("an unknown id rejects with AdminNotificationNotFoundError for both actions", async () => {
    await assert.rejects(() => markAdminNotificationRead(BigInt(999999999), true), AdminNotificationNotFoundError);
    await assert.rejects(() => setAdminNotificationArchived(BigInt(999999999), true), AdminNotificationNotFoundError);
  });
});

// Both bulk actions operate on every active row globally (no per-row
// scoping), so these assertions only check the specific rows this test
// seeded — never a global count — to stay correct alongside other tests
// that may be creating/archiving their own rows concurrently.
describe("markAllAdminNotificationsRead / archiveAllAdminNotifications — bulk actions", () => {
  test("marks every active unread row read, leaves already-read and archived rows alone", async () => {
    const activeUnread1 = await seed({ isRead: false, isArchived: false });
    const activeUnread2 = await seed({ isRead: false, isArchived: false });
    const alreadyRead = await seed({ isRead: true, isArchived: false });
    const archivedUnread = await seed({ isRead: false, isArchived: true });
    try {
      await markAllAdminNotificationsRead();

      const rows = await prisma.adminNotification.findMany({
        where: { id: { in: [activeUnread1.id, activeUnread2.id, alreadyRead.id, archivedUnread.id] } },
      });
      const byId = new Map(rows.map((r) => [r.id.toString(), r]));
      assert.equal(byId.get(activeUnread1.id.toString())!.isRead, true);
      assert.equal(byId.get(activeUnread2.id.toString())!.isRead, true);
      assert.equal(byId.get(alreadyRead.id.toString())!.isRead, true);
      // Archived rows are out of scope for this bulk action.
      assert.equal(byId.get(archivedUnread.id.toString())!.isRead, false);
    } finally {
      await cleanup([activeUnread1.id, activeUnread2.id, alreadyRead.id, archivedUnread.id]);
    }
  });

  test("archives every active row regardless of read state, leaves already-archived rows alone", async () => {
    const active1 = await seed({ isRead: false, isArchived: false });
    const active2 = await seed({ isRead: true, isArchived: false });
    const alreadyArchived = await seed({ isRead: false, isArchived: true });
    try {
      await archiveAllAdminNotifications();

      const rows = await prisma.adminNotification.findMany({
        where: { id: { in: [active1.id, active2.id, alreadyArchived.id] } },
      });
      const byId = new Map(rows.map((r) => [r.id.toString(), r]));
      assert.equal(byId.get(active1.id.toString())!.isArchived, true);
      assert.equal(byId.get(active2.id.toString())!.isArchived, true);
      assert.equal(byId.get(alreadyArchived.id.toString())!.isArchived, true);
    } finally {
      await cleanup([active1.id, active2.id, alreadyArchived.id]);
    }
  });
});
