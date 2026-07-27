import { type Notification, NotificationType, type Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function serializeNotification(notification: Notification) {
  return {
    id: notification.id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    pinned: notification.pinned,
    isRead: notification.isRead,
    isArchived: notification.isArchived,
    relatedBookingId: notification.relatedBookingId ? notification.relatedBookingId.toString() : null,
    relatedListingId: notification.relatedListingId ? notification.relatedListingId.toString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

// Feeds the navbar bell dropdown — unarchived only, no pagination (the
// dropdown itself caps what it renders to 10 and offers "View more" through
// to getNotificationsPage below for anything beyond that). Pinned first
// (regardless of age — see the Notification.pinned schema comment), then
// newest first within each group. Postgres sorts booleans false < true, so
// `pinned: "desc"` puts true rows first.
export async function getNotifications(userId: string): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
}

const NOTIFICATIONS_PER_PAGE = 10;

// Feeds the full /notifications (and /supplier-notifications) page — same
// Active/Archived + pagination shape as getAdminNotifications, just scoped
// to one user's own rows instead of the shared admin feed.
export async function getNotificationsPage(userId: string, options: { status: "active" | "archived"; page?: number }) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.NotificationWhereInput = { userId, isArchived: options.status === "archived" };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * NOTIFICATIONS_PER_PAGE,
      take: NOTIFICATIONS_PER_PAGE,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map(serializeNotification),
    meta: { page, perPage: NOTIFICATIONS_PER_PAGE, total },
  };
}

export class NotificationNotFoundError extends Error {
  constructor() {
    super("Notification not found.");
  }
}

// Pinned notifications are never cleared by this — they only disappear when
// whatever they're tracking actually resolves (the row gets deleted
// elsewhere, e.g. resolveBookingCreditWithRefund/createBookingWithDebit for
// booking_credit_pending). Marking one "read" here is a harmless no-op on
// its pinned-first sort position, matching the product ask that it "stay
// there until cleared" rather than being dismissible by a read click.
export async function markNotificationRead(userId: string, notificationId: bigint): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  if (result.count === 0) throw new NotificationNotFoundError();
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

// Toggles both ways — the Archived view's icon un-archives (restores to
// Active) rather than being a one-way trip, mirroring
// setAdminNotificationArchived.
export async function setNotificationArchived(userId: string, notificationId: bigint, isArchived: boolean): Promise<void> {
  const result = await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isArchived } });
  if (result.count === 0) throw new NotificationNotFoundError();
}

// Proactive, not event-triggered — nothing "happens" when a cert is about to
// expire, so this has to be swept on a schedule (same cron entry point as
// sweepOverdueBookingCredits, lib/bookings.ts — see
// app/api/cron/resolve-pending-booking-credits/route.ts). App-layer
// findFirst-then-create dedup on (userId, relatedCertificateId, type) —
// deliberately not a DB unique constraint, since that column is also used by
// cert_earned, where a second notification for the same cert IS legitimate
// (re-earning/renewing after expiry, per issueCredential's own upsert
// comment). A single-sweep-per-day cron has no real concurrent-write race to
// guard against here, unlike e.g. the booking-overlap constraint.
export async function sweepExpiringCertificateNotifications(withinDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const expiringSoon = await prisma.userCertificate.findMany({
    where: { expiryDate: { not: null, gte: new Date(), lte: cutoff } },
    include: { certificate: true },
  });

  let created = 0;
  for (const uc of expiringSoon) {
    const existing = await prisma.notification.findFirst({
      where: { userId: uc.userId, relatedCertificateId: uc.certificateId, type: NotificationType.cert_expiry },
    });
    if (existing) continue;

    const daysLeft = Math.ceil((uc.expiryDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    await prisma.notification.create({
      data: {
        userId: uc.userId,
        type: NotificationType.cert_expiry,
        title: "Certification expiring",
        message: `"${uc.certificate.name}" certification expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        relatedCertificateId: uc.certificateId,
      },
    });
    created += 1;
  }
  return created;
}
