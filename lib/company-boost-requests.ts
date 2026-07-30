import {
  CompanyBoostRequestStatus,
  CompanyBoostRequestType,
  NotificationType,
  type CompanyBoostRequest,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { purchaseBumps, InsufficientCompanyPurchasedBalanceError } from "@/lib/company-credits";
import { purchaseAndApplyPin, ListingNotFoundError, ListingNotAvailableError } from "@/lib/listings";
import { purchaseBoostProduct, BoostProductNotFoundError, BoostProductInactiveError } from "@/lib/boost-products";
import { NotCompanyAdminError } from "@/lib/company-membership";

// 2026-07-28 "Boost catalogue — delegated spend" (Audit-LeftoverSprint.md's
// "build the same delegated-permission pattern on the supplier side" follow-
// up). A member without companyCanPurchaseBoosts can still ask to spend the
// shared company purchasedBalance on the Boost catalogue (Bumps/Pin today —
// see CompanyBoostRequest's own schema comment for why this stays generic
// as more catalogue products land) — this module is the request queue:
// createCompanyBoostRequest (member submits), getCompanyBoostRequests
// (admin's queue), fulfillCompanyBoostRequest/declineCompanyBoostRequest
// (admin resolves it). Deliberately a separate file from
// lib/company-membership.ts, same "split by concern, not by model"
// precedent as lib/buyer-org-spend-requests.ts vs. lib/buyer-organizations.ts.

export class CompanyBoostRequestNotFoundError extends Error {
  constructor() {
    super("Boost request not found.");
  }
}

export class CompanyBoostRequestNotPendingError extends Error {
  constructor() {
    super("This request has already been resolved.");
  }
}

interface ParsedBumpBoostRequest {
  type: "bump";
  quantity: number;
}

interface ParsedPinBoostRequest {
  type: "pin";
  listingId: bigint;
  durationDays: 7 | 30;
}

interface ParsedProductBoostRequest {
  type: "product";
  boostProductId: bigint;
  quantity: number;
}

export type ParsedCompanyBoostRequestFields = ParsedBumpBoostRequest | ParsedPinBoostRequest | ParsedProductBoostRequest;

// Mirrors parseSpendRequestFields' shape (lib/buyer-org-spend-requests.ts) —
// a narrower shape than the direct purchase routes' own body (no admin-only
// concerns), just enough to describe the ask.
export function parseCompanyBoostRequestFields(body: unknown): ParsedCompanyBoostRequestFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (b.type !== "bump" && b.type !== "pin" && b.type !== "product") {
    errors.type = ["type must be one of bump, pin, product."];
  }

  if (b.type === "bump") {
    if (typeof b.quantity !== "number" || !Number.isInteger(b.quantity) || b.quantity < 1) {
      errors.quantity = ["quantity must be an integer of at least 1."];
    }
  } else if (b.type === "pin") {
    const rawListingId = typeof b.listingId === "number" ? String(b.listingId) : b.listingId;
    if (typeof rawListingId !== "string" || !/^\d+$/.test(rawListingId)) {
      errors.listingId = ["listingId is required."];
    }
    if (b.durationDays !== 7 && b.durationDays !== 30) {
      errors.durationDays = ["durationDays must be 7 or 30."];
    }
  } else if (b.type === "product") {
    const rawProductId = typeof b.boostProductId === "number" ? String(b.boostProductId) : b.boostProductId;
    if (typeof rawProductId !== "string" || !/^\d+$/.test(rawProductId)) {
      errors.boostProductId = ["boostProductId is required."];
    }
    if (typeof b.quantity !== "number" || !Number.isInteger(b.quantity) || b.quantity < 1) {
      errors.quantity = ["quantity must be an integer of at least 1."];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  if (b.type === "bump") {
    return { type: "bump", quantity: b.quantity as number };
  }
  if (b.type === "product") {
    const rawProductId = typeof b.boostProductId === "number" ? String(b.boostProductId) : (b.boostProductId as string);
    return { type: "product", boostProductId: BigInt(rawProductId), quantity: b.quantity as number };
  }
  const rawListingId = typeof b.listingId === "number" ? String(b.listingId) : (b.listingId as string);
  return { type: "pin", listingId: BigInt(rawListingId), durationDays: b.durationDays as 7 | 30 };
}

// Member-submitted — any company member may call this (the frontend only
// surfaces it when the caller lacks companyCanPurchaseBoosts, but a
// permitted member calling it too is harmless, just extra admin review). A
// Pin request must reference one of the caller's OWN company's listings
// (unlike a buyer-org spend request, which can target any marketplace
// listing) — fail fast here rather than at fulfillment time. A product
// request must reference an active, custom (builtinEffect "none")
// BoostProduct — same fail-fast reasoning.
export async function createCompanyBoostRequest(
  requestedByUserId: string,
  companyId: bigint,
  fields: ParsedCompanyBoostRequestFields
): Promise<CompanyBoostRequest> {
  if (fields.type === "pin") {
    const listing = await prisma.listing.findUnique({ where: { id: fields.listingId } });
    if (!listing || listing.companyId !== companyId) {
      throw new ListingNotFoundError();
    }
  }

  let productName: string | null = null;
  if (fields.type === "product") {
    const product = await prisma.boostProduct.findUnique({ where: { id: fields.boostProductId } });
    if (!product || product.builtinEffect !== "none") throw new BoostProductNotFoundError();
    if (!product.active) throw new BoostProductInactiveError();
    productName = product.name;
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.companyBoostRequest.create({
      data: {
        companyId,
        requestedByUserId,
        type:
          fields.type === "bump" ? CompanyBoostRequestType.bump : fields.type === "pin" ? CompanyBoostRequestType.pin : CompanyBoostRequestType.product,
        ...(fields.type === "bump"
          ? { quantity: fields.quantity }
          : fields.type === "pin"
            ? { listingId: fields.listingId, durationDays: fields.durationDays }
            : { boostProductId: fields.boostProductId, quantity: fields.quantity }),
      },
    });

    const [requester, admins] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: requestedByUserId }, select: { name: true } }),
      tx.user.findMany({ where: { companyId, isCompanyAdmin: true }, select: { id: true } }),
    ]);

    const listingName =
      fields.type === "pin"
        ? (await tx.listing.findUnique({ where: { id: fields.listingId }, select: { name: true } }))?.name
        : null;

    for (const admin of admins) {
      await tx.notification.create({
        data: {
          userId: admin.id,
          type: NotificationType.company_boost_request,
          title: "Boost catalogue spend request",
          message:
            fields.type === "bump"
              ? `${requester.name} wants to buy ${fields.quantity} Bump${fields.quantity === 1 ? "" : "s"} using company funds.`
              : fields.type === "pin"
                ? `${requester.name} wants to pin "${listingName ?? "a listing"}" for ${fields.durationDays} days using company funds.`
                : `${requester.name} wants to buy ${fields.quantity}x ${productName} using company funds.`,
          relatedListingId: fields.type === "pin" ? fields.listingId : undefined,
        },
      });
    }

    return request;
  });
}

const boostRequestListArgs = {
  include: {
    requestedBy: { select: { id: true, name: true, email: true } },
    listing: { select: { name: true } },
    boostProduct: { select: { name: true } },
  },
} as const;

export type CompanyBoostRequestWithRelations = Awaited<ReturnType<typeof getCompanyBoostRequests>>[number];

export async function getCompanyBoostRequests(companyId: bigint, status?: CompanyBoostRequestStatus) {
  return prisma.companyBoostRequest.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    ...boostRequestListArgs,
    orderBy: { createdAt: "desc" },
  });
}

export async function getCompanyBoostRequestById(id: bigint) {
  return prisma.companyBoostRequest.findUnique({ where: { id }, ...boostRequestListArgs });
}

export function serializeCompanyBoostRequest(request: CompanyBoostRequestWithRelations) {
  return {
    id: request.id.toString(),
    type: request.type,
    status: request.status,
    requestedBy: request.requestedBy,
    quantity: request.quantity,
    listingId: request.listingId ? request.listingId.toString() : null,
    listingName: request.listing?.name ?? null,
    durationDays: request.durationDays,
    boostProductId: request.boostProductId ? request.boostProductId.toString() : null,
    // Falls back once a referenced custom product has since been deleted
    // (boostProductId goes null via onDelete: SetNull) — the request row
    // itself is kept as a historical record either way.
    boostProductName: request.boostProduct?.name ?? (request.type === "product" ? "a since-removed product" : null),
    declineReason: request.declineReason,
    createdAt: request.createdAt.toISOString(),
  };
}

// Admin-only (caller must pass requireCompanyAdmin() first — this re-derives
// the admin row itself, same defense-in-depth pattern as
// fulfillBuyerOrgSpendRequest). Calls the exact same purchaseBumps/
// purchaseAndApplyPin the direct-purchase routes already call — this
// function only adds the request layer in front of them, attributed to the
// REQUESTING member's own userId (never the admin's), same "who did it" ledger
// discipline as the buyer-org pool.
export async function fulfillCompanyBoostRequest(
  actingAdminUserId: string,
  requestId: bigint
): Promise<CompanyBoostRequest> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isCompanyAdmin || !admin.companyId) throw new NotCompanyAdminError();

  const request = await prisma.companyBoostRequest.findUnique({ where: { id: requestId } });
  if (!request || request.companyId !== admin.companyId) {
    throw new CompanyBoostRequestNotFoundError();
  }
  if (request.status !== CompanyBoostRequestStatus.pending) {
    throw new CompanyBoostRequestNotPendingError();
  }

  let notificationMessage: string;
  let notificationTitle: string;
  if (request.type === CompanyBoostRequestType.bump) {
    const { bumpsAvailable } = await purchaseBumps(admin.companyId, request.quantity!, request.requestedByUserId);
    notificationMessage = `Your company admin approved your request — ${request.quantity} Bump${
      request.quantity === 1 ? "" : "s"
    } purchased (${bumpsAvailable} now available).`;
    notificationTitle = "Bump purchase approved";
  } else if (request.type === CompanyBoostRequestType.pin) {
    const listing = await purchaseAndApplyPin(
      admin.companyId,
      request.listingId!,
      request.durationDays as 7 | 30,
      request.requestedByUserId
    );
    notificationMessage = `Your company admin approved your request — "${listing.name}" is now pinned for ${request.durationDays} days.`;
    notificationTitle = "Pin purchase approved";
  } else {
    const { product, quantity } = await purchaseBoostProduct(
      admin.companyId,
      request.boostProductId!,
      request.quantity!,
      request.requestedByUserId
    );
    notificationMessage = `Your company admin approved your request — ${quantity}x ${product.name} purchased.`;
    notificationTitle = "Purchase approved";
  }

  const updated = await prisma.companyBoostRequest.update({
    where: { id: request.id },
    data: { status: CompanyBoostRequestStatus.fulfilled, resolvedByUserId: actingAdminUserId, resolvedAt: new Date() },
  });

  await prisma.notification.create({
    data: {
      userId: request.requestedByUserId,
      title: notificationTitle,
      message: notificationMessage,
      relatedListingId: request.listingId ?? undefined,
    },
  });

  return updated;
}

export async function declineCompanyBoostRequest(
  actingAdminUserId: string,
  requestId: bigint,
  reason?: string
): Promise<CompanyBoostRequest> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isCompanyAdmin || !admin.companyId) throw new NotCompanyAdminError();

  const request = await prisma.companyBoostRequest.findUnique({ where: { id: requestId } });
  if (!request || request.companyId !== admin.companyId) {
    throw new CompanyBoostRequestNotFoundError();
  }
  if (request.status !== CompanyBoostRequestStatus.pending) {
    throw new CompanyBoostRequestNotPendingError();
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.companyBoostRequest.update({
      where: { id: request.id },
      data: {
        status: CompanyBoostRequestStatus.declined,
        declineReason: reason ?? null,
        resolvedByUserId: actingAdminUserId,
        resolvedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: request.requestedByUserId,
        title:
          request.type === CompanyBoostRequestType.bump
            ? "Bump purchase declined"
            : request.type === CompanyBoostRequestType.pin
              ? "Pin purchase declined"
              : "Purchase declined",
        message: reason
          ? `Your company admin declined your request: ${reason}`
          : "Your company admin declined your request.",
        relatedListingId: request.listingId ?? undefined,
      },
    });

    return updated;
  });
}

export { InsufficientCompanyPurchasedBalanceError, ListingNotFoundError, ListingNotAvailableError };
