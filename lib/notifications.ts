import { type Notification, NotificationType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function serializeNotification(notification: Notification) {
  return {
    id: notification.id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    pinned: notification.pinned,
    isRead: notification.isRead,
    relatedBookingId: notification.relatedBookingId ? notification.relatedBookingId.toString() : null,
    relatedListingId: notification.relatedListingId ? notification.relatedListingId.toString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

// Pinned first (regardless of age — see the Notification.pinned schema
// comment), then newest first within each group. Postgres sorts booleans
// false < true, so `pinned: "desc"` puts true rows first.
export async function getNotifications(userId: string): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
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
