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

export class CompanyAlreadyHasAdminError extends Error {
  constructor() {
    super("Your company already has an admin — ask them to promote you instead.");
  }
}

export class NotCompanyAdminError extends Error {
  constructor() {
    super("This action requires company admin access.");
  }
}

export class TargetNotInCompanyError extends Error {
  constructor() {
    super("That user is not a member of your company.");
  }
}

async function companyHasAdmin(companyId: bigint): Promise<boolean> {
  const admin = await prisma.user.findFirst({ where: { companyId, isCompanyAdmin: true } });
  return admin !== null;
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
//
// 2026-07-23 amendment: this only reaches the system-admin queue when the
// company has no admin at all yet — nothing else could seat one. Once a
// company has an admin, that admin promotes members directly
// (promoteMemberDirectly, below), no system-admin round trip needed.
export async function requestPromotion(userId: string): Promise<User> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.isCompanyAdmin) throw new AlreadyCompanyAdminError();
  if (user.promotionRequested) throw new PromotionAlreadyRequestedError();
  if (user.companyId && (await companyHasAdmin(user.companyId))) {
    throw new CompanyAlreadyHasAdminError();
  }

  return prisma.user.update({
    where: { id: userId },
    data: { promotionRequested: true },
  });
}

// Admin-initiated: the company's own admin promotes a fellow member
// directly — no system-admin queue involved. New capability, 2026-07-23,
// alongside the Buyer Organization membership build (lib/buyer-organizations.ts
// mirrors this exactly).
export async function promoteMemberDirectly(actingAdminUserId: string, targetUserId: string): Promise<User> {
  const actingAdmin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!actingAdmin.isCompanyAdmin || !actingAdmin.companyId) throw new NotCompanyAdminError();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (target.companyId !== actingAdmin.companyId) throw new TargetNotInCompanyError();
  if (target.isCompanyAdmin) throw new AlreadyCompanyAdminError();

  return prisma.user.update({
    where: { id: targetUserId },
    data: { isCompanyAdmin: true, promotionRequested: false },
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
