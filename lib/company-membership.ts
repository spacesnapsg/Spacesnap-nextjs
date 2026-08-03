import { AdminNotificationType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { createAdminNotification } from "@/lib/admin-notifications";

// Sprint 6.10 follow-on (2026-07-23) — company-side membership management.
// Closes the gap flagged while scoping Buyer Organization: Company never had
// a "join" concept at all before this — a user only ever got a companyId via
// prisma/seed.ts. Search-or-create at signup (or later, self-service) is the
// new join entry point; lib/promotions.ts already covers promote-to-admin.

export class CompanyJoinRequestAlreadyPendingError extends Error {
  constructor() {
    super("You already have a pending request to join this company.");
  }
}

export class NotCompanyAdminError extends Error {
  constructor() {
    super("This action requires company admin access.");
  }
}

export class CannotRemoveSelfError extends Error {
  constructor() {
    super("You can't remove yourself from the company.");
  }
}

export class NotInSameCompanyError extends Error {
  constructor() {
    super("That user is not a member of your company.");
  }
}

export class CompanyJoinRequestNotFoundError extends Error {
  constructor() {
    super("Join request not found.");
  }
}

export class CompanyJoinRequestNotPendingError extends Error {
  constructor() {
    super("This request has already been resolved.");
  }
}

export async function searchCompaniesByName(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const companies = await prisma.company.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  return companies.map((c) => ({ id: c.id.toString(), name: c.name }));
}

export interface CompanyMembershipResult {
  status: "joined" | "pending";
  company: { id: string; name: string };
}

// Find-or-create by exact case-insensitive name match, then seat immediately
// (no admin exists yet — nothing to gate against) or queue a join request for
// the company's own admin to approve. Used both at signup
// (app/api/auth/register/route.ts) and post-signup self-service joins.
export async function resolveCompanyMembership(
  userId: string,
  rawName: string
): Promise<CompanyMembershipResult> {
  const name = rawName.trim();
  if (!name) {
    throw new ApiValidationError({ companyName: ["Company name is required."] });
  }

  return prisma.$transaction(async (tx) => {
    const actingUser = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });

    let company = await tx.company.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (!company) {
      company = await tx.company.create({ data: { name } });
      await tx.user.update({
        where: { id: userId },
        data: { companyId: company.id, isSupplier: true },
      });
      await createAdminNotification(tx, {
        type: AdminNotificationType.new_supplier,
        title: "New supplier",
        message: `${actingUser.name} is now a supplier at ${company.name}.`,
        relatedUserId: userId,
        relatedCompanyId: company.id,
      });
      return { status: "joined" as const, company: { id: company.id.toString(), name: company.name } };
    }

    const hasAdmin = await tx.user.findFirst({
      where: { companyId: company.id, isCompanyAdmin: true },
    });

    if (!hasAdmin) {
      await tx.user.update({
        where: { id: userId },
        data: { companyId: company.id, isSupplier: true },
      });
      await createAdminNotification(tx, {
        type: AdminNotificationType.new_supplier,
        title: "New supplier",
        message: `${actingUser.name} is now a supplier at ${company.name}.`,
        relatedUserId: userId,
        relatedCompanyId: company.id,
      });
      return { status: "joined" as const, company: { id: company.id.toString(), name: company.name } };
    }

    const existingPending = await tx.companyJoinRequest.findFirst({
      where: { companyId: company.id, requestedByUserId: userId, status: "pending" },
    });
    if (existingPending) throw new CompanyJoinRequestAlreadyPendingError();

    await tx.companyJoinRequest.create({
      data: { companyId: company.id, requestedByUserId: userId },
    });
    return { status: "pending" as const, company: { id: company.id.toString(), name: company.name } };
  });
}

export async function getCompanyMembers(companyId: bigint) {
  return prisma.user.findMany({
    where: { companyId },
    select: { id: true, name: true, email: true, isCompanyAdmin: true, companyCanPurchaseBoosts: true },
    orderBy: [{ isCompanyAdmin: "desc" }, { name: "asc" }],
  });
}

export async function removeCompanyMember(actingAdminUserId: string, targetUserId: string) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isCompanyAdmin || !admin.companyId) throw new NotCompanyAdminError();
  if (targetUserId === actingAdminUserId) throw new CannotRemoveSelfError();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (target.companyId !== admin.companyId) throw new NotInSameCompanyError();

  return prisma.user.update({
    where: { id: targetUserId },
    data: {
      companyId: null,
      isCompanyAdmin: false,
      isSupplier: false,
      promotionRequested: false,
      companyCanPurchaseBoosts: false,
    },
  });
}

// Delegated Boost-catalogue spend permission — see User.companyCanPurchaseBoosts's
// own schema comment for why this is one flag, not one per product.
export async function setMemberBoostPermission(
  actingAdminUserId: string,
  targetUserId: string,
  canPurchaseBoosts: boolean
) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isCompanyAdmin || !admin.companyId) throw new NotCompanyAdminError();

  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (target.companyId !== admin.companyId) throw new NotInSameCompanyError();

  return prisma.user.update({ where: { id: targetUserId }, data: { companyCanPurchaseBoosts: canPurchaseBoosts } });
}

export async function getPendingCompanyJoinRequests(companyId: bigint) {
  return prisma.companyJoinRequest.findMany({
    where: { companyId, status: "pending" },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveCompanyJoinRequest(
  actingAdminUserId: string,
  requestId: bigint,
  decision: "approved" | "rejected",
  reason?: string
) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isCompanyAdmin || !admin.companyId) throw new NotCompanyAdminError();

  return prisma.$transaction(async (tx) => {
    const request = await tx.companyJoinRequest.findUnique({ where: { id: requestId } });
    if (!request || request.companyId !== admin.companyId) throw new CompanyJoinRequestNotFoundError();
    if (request.status !== "pending") throw new CompanyJoinRequestNotPendingError();

    const updated = await tx.companyJoinRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        declineReason: decision === "rejected" ? (reason ?? null) : null,
        resolvedByUserId: actingAdminUserId,
        resolvedAt: new Date(),
      },
    });

    if (decision === "approved") {
      const [requestedByUser, company] = await Promise.all([
        tx.user.update({
          where: { id: request.requestedByUserId },
          data: { companyId: admin.companyId, isSupplier: true },
        }),
        tx.company.findUniqueOrThrow({ where: { id: admin.companyId }, select: { name: true } }),
      ]);
      await createAdminNotification(tx, {
        type: AdminNotificationType.new_supplier,
        title: "New supplier",
        message: `${requestedByUser.name} is now a supplier at ${company.name}.`,
        relatedUserId: requestedByUser.id,
        relatedCompanyId: admin.companyId,
      });
    } else {
      await tx.notification.create({
        data: {
          userId: request.requestedByUserId,
          title: "Company join request declined",
          message: reason
            ? `Your request to join the company was declined: ${reason}`
            : "Your request to join the company was declined.",
        },
      });
    }

    return updated;
  });
}
