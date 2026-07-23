import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

// Sprint 6.10 "User-Side Buyer Organization" (2026-07-23) — structural mirror
// of lib/company-membership.ts, scoped to BuyerOrganization instead of
// Company. Same state machine: search-or-create by name, seat immediately if
// the org has no admin yet, otherwise queue a join request for the org's own
// admin. Promotion-to-admin mirrors lib/promotions.ts's own "only reaches
// SpaceSnap's system admin when the org has no admin at all" rule.

export class BuyerOrgJoinRequestAlreadyPendingError extends Error {
  constructor() {
    super("You already have a pending request to join this organization.");
  }
}

export class NotBuyerOrgAdminError extends Error {
  constructor() {
    super("This action requires organization admin access.");
  }
}

export class CannotRemoveSelfError extends Error {
  constructor() {
    super("You can't remove yourself from the organization.");
  }
}

export class NotInSameOrgError extends Error {
  constructor() {
    super("That user is not a member of your organization.");
  }
}

export class BuyerOrgJoinRequestNotFoundError extends Error {
  constructor() {
    super("Join request not found.");
  }
}

export class BuyerOrgJoinRequestNotPendingError extends Error {
  constructor() {
    super("This request has already been resolved.");
  }
}

export class AlreadyBuyerOrgAdminError extends Error {
  constructor() {
    super("You are already an organization admin.");
  }
}

export class BuyerOrgPromotionAlreadyRequestedError extends Error {
  constructor() {
    super("A promotion request is already pending.");
  }
}

export class BuyerOrgPromotionNotPendingError extends Error {
  constructor() {
    super("This user has no pending promotion request.");
  }
}

export class BuyerOrgAlreadyHasAdminError extends Error {
  constructor() {
    super("Your organization already has an admin — ask them to promote you instead.");
  }
}

export async function searchBuyerOrganizationsByName(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const orgs = await prisma.buyerOrganization.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  return orgs.map((o) => ({ id: o.id.toString(), name: o.name }));
}

export interface BuyerOrgMembershipResult {
  status: "joined" | "pending";
  organization: { id: string; name: string };
}

async function buyerOrgHasAdmin(buyerOrganizationId: bigint): Promise<boolean> {
  const admin = await prisma.user.findFirst({
    where: { buyerOrganizationId, isBuyerOrgAdmin: true },
  });
  return admin !== null;
}

// Find-or-create by exact case-insensitive name match, then seat immediately
// or queue a join request — same idiom as resolveCompanyMembership. Used at
// signup (app/api/auth/register/route.ts) and the post-signup self-service
// join route (POST /api/buyer-organization/join).
export async function resolveBuyerOrgMembership(
  userId: string,
  rawName: string
): Promise<BuyerOrgMembershipResult> {
  const name = rawName.trim();
  if (!name) {
    throw new ApiValidationError({ buyerOrganizationName: ["Organization name is required."] });
  }

  return prisma.$transaction(async (tx) => {
    let org = await tx.buyerOrganization.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (!org) {
      org = await tx.buyerOrganization.create({ data: { name } });
      await tx.user.update({
        where: { id: userId },
        data: { buyerOrganizationId: org.id },
      });
      return { status: "joined" as const, organization: { id: org.id.toString(), name: org.name } };
    }

    const hasAdmin = await tx.user.findFirst({
      where: { buyerOrganizationId: org.id, isBuyerOrgAdmin: true },
    });

    if (!hasAdmin) {
      await tx.user.update({
        where: { id: userId },
        data: { buyerOrganizationId: org.id },
      });
      return { status: "joined" as const, organization: { id: org.id.toString(), name: org.name } };
    }

    const existingPending = await tx.buyerOrganizationJoinRequest.findFirst({
      where: { buyerOrganizationId: org.id, requestedByUserId: userId, status: "pending" },
    });
    if (existingPending) throw new BuyerOrgJoinRequestAlreadyPendingError();

    await tx.buyerOrganizationJoinRequest.create({
      data: { buyerOrganizationId: org.id, requestedByUserId: userId },
    });
    return { status: "pending" as const, organization: { id: org.id.toString(), name: org.name } };
  });
}

export async function getBuyerOrgMembers(buyerOrganizationId: bigint) {
  return prisma.user.findMany({
    where: { buyerOrganizationId },
    select: { id: true, name: true, email: true, isBuyerOrgAdmin: true },
    orderBy: [{ isBuyerOrgAdmin: "desc" }, { name: "asc" }],
  });
}

export async function removeBuyerOrgMember(actingAdminUserId: string, targetUserId: string) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isBuyerOrgAdmin || !admin.buyerOrganizationId) throw new NotBuyerOrgAdminError();
  if (targetUserId === actingAdminUserId) throw new CannotRemoveSelfError();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (target.buyerOrganizationId !== admin.buyerOrganizationId) throw new NotInSameOrgError();

  return prisma.user.update({
    where: { id: targetUserId },
    data: { buyerOrganizationId: null, isBuyerOrgAdmin: false, buyerOrgPromotionRequested: false },
  });
}

export async function getPendingBuyerOrgJoinRequests(buyerOrganizationId: bigint) {
  return prisma.buyerOrganizationJoinRequest.findMany({
    where: { buyerOrganizationId, status: "pending" },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveBuyerOrgJoinRequest(
  actingAdminUserId: string,
  requestId: bigint,
  decision: "approved" | "rejected"
) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isBuyerOrgAdmin || !admin.buyerOrganizationId) throw new NotBuyerOrgAdminError();

  return prisma.$transaction(async (tx) => {
    const request = await tx.buyerOrganizationJoinRequest.findUnique({ where: { id: requestId } });
    if (!request || request.buyerOrganizationId !== admin.buyerOrganizationId) {
      throw new BuyerOrgJoinRequestNotFoundError();
    }
    if (request.status !== "pending") throw new BuyerOrgJoinRequestNotPendingError();

    const updated = await tx.buyerOrganizationJoinRequest.update({
      where: { id: requestId },
      data: { status: decision, resolvedByUserId: actingAdminUserId, resolvedAt: new Date() },
    });

    if (decision === "approved") {
      await tx.user.update({
        where: { id: request.requestedByUserId },
        data: { buyerOrganizationId: admin.buyerOrganizationId },
      });
    }

    return updated;
  });
}

// Self-service: the caller requests promotion to org admin. Only reaches the
// system-admin queue when the org has no admin at all yet — once one exists,
// promoteBuyerOrgMemberDirectly (below) is how it happens instead.
export async function requestBuyerOrgPromotion(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.isBuyerOrgAdmin) throw new AlreadyBuyerOrgAdminError();
  if (user.buyerOrgPromotionRequested) throw new BuyerOrgPromotionAlreadyRequestedError();
  if (user.buyerOrganizationId && (await buyerOrgHasAdmin(user.buyerOrganizationId))) {
    throw new BuyerOrgAlreadyHasAdminError();
  }

  return prisma.user.update({
    where: { id: userId },
    data: { buyerOrgPromotionRequested: true },
  });
}

export async function getPendingBuyerOrgPromotions() {
  return prisma.user.findMany({
    where: { buyerOrgPromotionRequested: true },
    include: { buyerOrganization: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function approveBuyerOrgPromotion(userId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return null;
  if (!existing.buyerOrgPromotionRequested) throw new BuyerOrgPromotionNotPendingError();

  return prisma.user.update({
    where: { id: userId },
    data: { isBuyerOrgAdmin: true, buyerOrgPromotionRequested: false },
    include: { buyerOrganization: true },
  });
}

export async function rejectBuyerOrgPromotion(userId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return null;
  if (!existing.buyerOrgPromotionRequested) throw new BuyerOrgPromotionNotPendingError();

  return prisma.user.update({
    where: { id: userId },
    data: { buyerOrgPromotionRequested: false },
    include: { buyerOrganization: true },
  });
}

// Admin-initiated: the org's own admin promotes a fellow member directly, no
// system-admin queue involved. New capability, 2026-07-23 — mirrors
// promoteMemberDirectly in lib/promotions.ts.
export async function promoteBuyerOrgMemberDirectly(actingAdminUserId: string, targetUserId: string) {
  const actingAdmin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!actingAdmin.isBuyerOrgAdmin || !actingAdmin.buyerOrganizationId) throw new NotBuyerOrgAdminError();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (target.buyerOrganizationId !== actingAdmin.buyerOrganizationId) throw new NotInSameOrgError();
  if (target.isBuyerOrgAdmin) throw new AlreadyBuyerOrgAdminError();

  return prisma.user.update({
    where: { id: targetUserId },
    data: { isBuyerOrgAdmin: true, buyerOrgPromotionRequested: false },
  });
}

export function serializePendingBuyerOrgPromotion(
  user: Awaited<ReturnType<typeof getPendingBuyerOrgPromotions>>[number]
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    buyerOrganizationId: user.buyerOrganizationId?.toString() ?? null,
    buyerOrganizationName: user.buyerOrganization?.name ?? null,
  };
}
