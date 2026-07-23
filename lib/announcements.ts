import type { Announcement } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

export function serializeAnnouncement(announcement: Announcement, isRead: boolean) {
  return {
    id: announcement.id.toString(),
    title: announcement.title,
    message: announcement.message,
    targetMembers: announcement.targetMembers,
    targetSuppliers: announcement.targetSuppliers,
    createdAt: announcement.createdAt.toISOString(),
    isRead,
  };
}

interface CreateAnnouncementInput {
  title?: string | null;
  message: string;
  targetMembers: boolean;
  targetSuppliers: boolean;
  createdByUserId: string;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  if (typeof input.message !== "string" || input.message.trim().length === 0) {
    throw new ApiValidationError({ message: ["message is required."] });
  }
  if (!input.targetMembers && !input.targetSuppliers) {
    throw new ApiValidationError({ audience: ["Select at least one audience (Members or Suppliers)."] });
  }

  return prisma.announcement.create({
    data: {
      title: input.title?.trim() || null,
      message: input.message.trim(),
      targetMembers: input.targetMembers,
      targetSuppliers: input.targetSuppliers,
      createdByUserId: input.createdByUserId,
    },
  });
}

// A "Both"-role account sees any announcement matching either of its roles
// — an OR across the two independent audience flags, not an exact match.
export async function getAnnouncementsForUser(
  userId: string,
  { isMember, isSupplier }: { isMember: boolean; isSupplier: boolean }
) {
  const announcements = await prisma.announcement.findMany({
    where: {
      OR: [...(isMember ? [{ targetMembers: true }] : []), ...(isSupplier ? [{ targetSuppliers: true }] : [])],
    },
    include: { reads: { where: { userId } } },
    orderBy: { createdAt: "desc" },
  });

  return announcements.map((a) => serializeAnnouncement(a, a.reads.length > 0));
}

export async function markAnnouncementRead(userId: string, announcementId: bigint): Promise<void> {
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId, userId } },
    create: { announcementId, userId },
    update: {},
  });
}

// Only marks announcements the caller can actually see as read — mirrors
// getAnnouncementsForUser's own audience filter so this can't create a
// read record for a broadcast this user was never targeted by.
export async function markAllAnnouncementsRead(
  userId: string,
  { isMember, isSupplier }: { isMember: boolean; isSupplier: boolean }
): Promise<void> {
  const eligible = await prisma.announcement.findMany({
    where: {
      OR: [...(isMember ? [{ targetMembers: true }] : []), ...(isSupplier ? [{ targetSuppliers: true }] : [])],
      reads: { none: { userId } },
    },
    select: { id: true },
  });

  if (eligible.length === 0) return;

  await prisma.announcementRead.createMany({
    data: eligible.map((a) => ({ announcementId: a.id, userId })),
    skipDuplicates: true,
  });
}

export function serializeAnnouncementSummary(announcement: Announcement) {
  return {
    id: announcement.id.toString(),
    title: announcement.title,
    message: announcement.message,
    targetMembers: announcement.targetMembers,
    targetSuppliers: announcement.targetSuppliers,
    createdAt: announcement.createdAt.toISOString(),
  };
}

// Admin's own send history — no per-user read state attached, just what
// was sent and to whom (unlike the recipient-facing list above).
export async function getAnnouncementHistory() {
  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return announcements.map(serializeAnnouncementSummary);
}
