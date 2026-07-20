import type { Company, User } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class AlreadyCompanyAdminError extends Error {
  constructor() {
    super("You are already a company admin.");
  }
}

export class PromotionAlreadyRequestedError extends Error {
  constructor() {
    super("A promotion request is already pending.");
  }
}

export class PromotionNotPendingError extends Error {
  constructor() {
    super("This user has no pending promotion request.");
  }
}

export function serializePendingPromotion(user: User & { company: Company | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyId: user.companyId?.toString() ?? null,
    companyName: user.company?.name ?? null,
  };
}

// Caller-initiated: a supplier asks to be promoted to company admin within
// their own company. Mirrors the frontend's "Request Promotion to Company
// Admin" button (supplier profile) — closes the gap where the
// `promotionRequested` column existed but nothing wrote to it.
export async function requestPromotion(userId: string): Promise<User> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.isCompanyAdmin) throw new AlreadyCompanyAdminError();
  if (user.promotionRequested) throw new PromotionAlreadyRequestedError();

  return prisma.user.update({
    where: { id: userId },
    data: { promotionRequested: true },
  });
}

export async function getPendingPromotions() {
  return prisma.user.findMany({
    where: { promotionRequested: true },
    include: { company: true },
    orderBy: { updatedAt: "desc" },
  });
}

// Approve: grant company-admin capability and clear the request flag.
export async function approvePromotion(userId: string): Promise<(User & { company: Company | null }) | null> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return null;
  if (!existing.promotionRequested) throw new PromotionNotPendingError();

  return prisma.user.update({
    where: { id: userId },
    data: { isCompanyAdmin: true, promotionRequested: false },
    include: { company: true },
  });
}

// Reject: clear the request flag only — the user stays a plain supplier.
export async function rejectPromotion(userId: string): Promise<(User & { company: Company | null }) | null> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return null;
  if (!existing.promotionRequested) throw new PromotionNotPendingError();

  return prisma.user.update({
    where: { id: userId },
    data: { promotionRequested: false },
    include: { company: true },
  });
}
