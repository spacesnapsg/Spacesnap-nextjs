import { AdminNotificationType, type AdminNotification, type Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// 2026-07-27 — admin-facing "what happened on the platform" feed. See the
// AdminNotification schema comment for how this differs from Notification
// (per-user) and Announcement (admin -> users). Shared across every system
// admin — no per-admin read/archive state.

// Accepts either the top-level client or a transaction client, since some
// call sites (createBookingWithDebit, issueCredential) fire this alongside
// other writes inside their own $transaction, and others (the signup route)
// don't have one open at all.
type Db = typeof prisma | Prisma.TransactionClient;

export function serializeAdminNotification(n: AdminNotification) {
  return {
    id: n.id.toString(),
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    isArchived: n.isArchived,
    relatedUserId: n.relatedUserId,
    relatedCompanyId: n.relatedCompanyId ? n.relatedCompanyId.toString() : null,
    relatedBookingId: n.relatedBookingId ? n.relatedBookingId.toString() : null,
    relatedCertificateId: n.relatedCertificateId ? n.relatedCertificateId.toString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

interface CreateAdminNotificationParams {
  type: AdminNotificationType;
  title: string;
  message: string;
  relatedUserId?: string;
  relatedCompanyId?: bigint;
  relatedBookingId?: bigint;
  relatedCertificateId?: bigint;
}

export async function createAdminNotification(db: Db, params: CreateAdminNotificationParams): Promise<void> {
  await db.adminNotification.create({ data: params });
}

const ADMIN_NOTIFICATIONS_PER_PAGE = 10;

export async function getAdminNotifications(options: { status: "active" | "archived"; page?: number }) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.AdminNotificationWhereInput = { isArchived: options.status === "archived" };

  const [notifications, total] = await Promise.all([
    prisma.adminNotification.findMany({
      where,
      // id as a secondary key: createdAt is millisecond-precision, and two
      // events firing in the same request (or just close together, e.g. a
      // burst of signups) can tie — Postgres doesn't guarantee any
      // particular order among ties, so without this "newest first" isn't
      // actually deterministic.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ADMIN_NOTIFICATIONS_PER_PAGE,
      take: ADMIN_NOTIFICATIONS_PER_PAGE,
    }),
    prisma.adminNotification.count({ where }),
  ]);

  return {
    notifications: notifications.map(serializeAdminNotification),
    meta: { page, perPage: ADMIN_NOTIFICATIONS_PER_PAGE, total },
  };
}

export class AdminNotificationNotFoundError extends Error {
  constructor() {
    super("Notification not found.");
  }
}

export async function markAdminNotificationRead(id: bigint, isRead: boolean): Promise<void> {
  const result = await prisma.adminNotification.updateMany({ where: { id }, data: { isRead } });
  if (result.count === 0) throw new AdminNotificationNotFoundError();
}

// Toggle in both directions — the archived view's icon un-archives (restores
// to Active) rather than being a one-way trip, so an accidental archive isn't
// permanent.
export async function setAdminNotificationArchived(id: bigint, isArchived: boolean): Promise<void> {
  const result = await prisma.adminNotification.updateMany({ where: { id }, data: { isArchived } });
  if (result.count === 0) throw new AdminNotificationNotFoundError();
}

// Both bulk actions are scoped to the Active view — archived rows are
// already out of the way, and "mark all as read" there wouldn't change
// anything visible (the unread badge only counts active+unread).
export async function markAllAdminNotificationsRead(): Promise<void> {
  await prisma.adminNotification.updateMany({ where: { isArchived: false, isRead: false }, data: { isRead: true } });
}

export async function archiveAllAdminNotifications(): Promise<void> {
  await prisma.adminNotification.updateMany({ where: { isArchived: false }, data: { isArchived: true } });
}
