import {
  BookingType,
  BuyerOrgSpendRequestStatus,
  BuyerOrgSpendRequestType,
  type BuyerOrgSpendRequest,
  type Booking,
  type Purchase,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { sgdToCredits } from "@/lib/credit-units";
import {
  createBookingWithDebit,
  hasOverlappingBooking,
  missingCertificateIds,
  BOOKING_OVERLAP_MESSAGE,
} from "@/lib/bookings";
import { createPurchaseWithDebit } from "@/lib/purchases";
import { getEffectiveCompanyPricing, markupPercentForBookingType, applyMarkup } from "@/lib/pricing";
import { ListingNotFoundError } from "@/lib/listings";
import { NotBuyerOrgAdminError } from "@/lib/buyer-organizations";

// 2026-07-28 "Buyer Org pool — delegated spend" (Audit-LeftoverSprint.md).
// A member without buyerOrgCanBook/buyerOrgCanPurchase can still ask to fund
// a booking/Buy Now purchase from their org's shared pool — this module is
// the request queue that results in: createBuyerOrgSpendRequest (member
// submits), getBuyerOrgSpendRequests (admin's queue), and
// fulfillBuyerOrgSpendRequest/declineBuyerOrgSpendRequest (admin resolves
// it). Deliberately a separate file from lib/buyer-organizations.ts — that
// module is membership/roles, this is a distinct request-and-fulfillment
// lifecycle, same "split by concern, not by model" precedent as
// lib/bookings.ts vs. lib/listings.ts.

export class BuyerOrgSpendRequestNotFoundError extends Error {
  constructor() {
    super("Spend request not found.");
  }
}

export class BuyerOrgSpendRequestNotPendingError extends Error {
  constructor() {
    super("This request has already been resolved.");
  }
}

export class BuyerOrgSpendRequestMissingCertificatesError extends Error {
  constructor(public readonly certificateNames: string[]) {
    super("The requesting member is missing required certificates for this listing.");
  }
}

export class BuyerOrgSpendRequestOverlapError extends Error {
  constructor() {
    super(BOOKING_OVERLAP_MESSAGE);
  }
}

const PRICE_FIELD = { daily: "priceDay", weekly: "priceWeek", monthly: "priceMonth" } as const;
const BOOKING_TYPES = new Set<string>(Object.values(BookingType));

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

interface ParsedBookingSpendRequest {
  type: "booking";
  listingId: bigint;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
}

interface ParsedPurchaseSpendRequest {
  type: "consumable_purchase";
  listingId: bigint;
  quantity: number;
}

export type ParsedSpendRequestFields = ParsedBookingSpendRequest | ParsedPurchaseSpendRequest;

// Mirrors parseBookingCreateFields/parsePurchaseCreateFields' relevant
// fields (lib/bookings.ts / lib/purchases.ts) — deliberately a narrower
// shape than either: no paymentMethodId (never charges Stripe), no
// rewardGrantId/bookingCreditId (a pool-funded request doesn't redeem the
// requester's own personal reward mechanics — kept simple, revisit if ever
// asked for).
export function parseSpendRequestFields(body: unknown): ParsedSpendRequestFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let listingId: bigint | null = null;
  const rawListingId = typeof b.listingId === "number" ? String(b.listingId) : b.listingId;
  if (typeof rawListingId !== "string" || !/^\d+$/.test(rawListingId)) {
    errors.listingId = ["listingId is required."];
  } else {
    listingId = BigInt(rawListingId);
  }

  if (b.type !== "booking" && b.type !== "consumable_purchase") {
    errors.type = ["type must be one of booking, consumable_purchase."];
  }

  if (b.type === "consumable_purchase") {
    if (typeof b.quantity !== "number" || !Number.isInteger(b.quantity) || b.quantity < 1) {
      errors.quantity = ["quantity must be an integer of at least 1."];
    }
  } else if (b.type === "booking") {
    if (typeof b.bookingType !== "string" || !BOOKING_TYPES.has(b.bookingType)) {
      errors.bookingType = ["bookingType must be one of daily, weekly, monthly."];
    }
    if (!isDateString(b.startDate)) {
      errors.startDate = ["startDate is required."];
    }
    if (!isDateString(b.endDate)) {
      errors.endDate = ["endDate is required."];
    } else if (isDateString(b.startDate) && Date.parse(b.endDate as string) < Date.parse(b.startDate as string)) {
      errors.endDate = ["endDate must be on or after startDate."];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  if (b.type === "consumable_purchase") {
    return { type: "consumable_purchase", listingId: listingId!, quantity: b.quantity as number };
  }
  return {
    type: "booking",
    listingId: listingId!,
    bookingType: b.bookingType as BookingType,
    startDate: b.startDate as string,
    endDate: b.endDate as string,
  };
}

// Member-submitted — any org member may call this (the frontend only
// surfaces it when the caller lacks buyerOrgCanBook/buyerOrgCanPurchase,
// but a permitted member calling it too is harmless, just extra admin
// review). Validates the listing exists and its type is consistent with the
// request type (fail fast here rather than at fulfillment time), then
// notifies every admin of this org.
export async function createBuyerOrgSpendRequest(
  requestedByUserId: string,
  buyerOrganizationId: bigint,
  fields: ParsedSpendRequestFields
): Promise<BuyerOrgSpendRequest> {
  const listing = await prisma.listing.findUnique({ where: { id: fields.listingId } });
  if (!listing) throw new ListingNotFoundError();

  if (fields.type === "booking" && listing.type === "consumables") {
    throw new ApiValidationError({ listingId: ["Consumables cannot be booked directly — request a purchase instead."] });
  }
  if (fields.type === "consumable_purchase" && listing.type !== "consumables") {
    throw new ApiValidationError({ listingId: ["Buy Now is only available for consumable listings."] });
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.buyerOrgSpendRequest.create({
      data: {
        buyerOrganizationId,
        requestedByUserId,
        type: fields.type === "booking" ? BuyerOrgSpendRequestType.booking : BuyerOrgSpendRequestType.consumable_purchase,
        listingId: fields.listingId,
        ...(fields.type === "booking"
          ? { bookingType: fields.bookingType, startDate: new Date(fields.startDate), endDate: new Date(fields.endDate) }
          : { quantity: fields.quantity }),
      },
    });

    const [requester, admins] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: requestedByUserId }, select: { name: true } }),
      tx.user.findMany({ where: { buyerOrganizationId, isBuyerOrgAdmin: true }, select: { id: true } }),
    ]);

    for (const admin of admins) {
      await tx.notification.create({
        data: {
          userId: admin.id,
          type: "buyer_org_spend_request",
          title: "Organization pool spend request",
          message:
            fields.type === "booking"
              ? `${requester.name} wants to book "${listing.name}" using the organization's pool.`
              : `${requester.name} wants to buy ${fields.quantity}x "${listing.name}" using the organization's pool.`,
          relatedListingId: fields.listingId,
        },
      });
    }

    return request;
  });
}

const spendRequestListArgs = {
  include: { requestedBy: { select: { id: true, name: true, email: true } }, listing: { select: { name: true, type: true } } },
} as const;

export type BuyerOrgSpendRequestWithRelations = Awaited<ReturnType<typeof getBuyerOrgSpendRequests>>[number];

export async function getBuyerOrgSpendRequests(buyerOrganizationId: bigint, status?: BuyerOrgSpendRequestStatus) {
  return prisma.buyerOrgSpendRequest.findMany({
    where: { buyerOrganizationId, ...(status ? { status } : {}) },
    ...spendRequestListArgs,
    orderBy: { createdAt: "desc" },
  });
}

export async function getBuyerOrgSpendRequestById(id: bigint) {
  return prisma.buyerOrgSpendRequest.findUnique({ where: { id }, ...spendRequestListArgs });
}

export function serializeBuyerOrgSpendRequest(request: BuyerOrgSpendRequestWithRelations) {
  return {
    id: request.id.toString(),
    type: request.type,
    status: request.status,
    requestedBy: request.requestedBy,
    listingId: request.listingId.toString(),
    listingName: request.listing.name,
    bookingType: request.bookingType,
    startDate: request.startDate ? request.startDate.toISOString().slice(0, 10) : null,
    endDate: request.endDate ? request.endDate.toISOString().slice(0, 10) : null,
    quantity: request.quantity,
    declineReason: request.declineReason,
    createdAt: request.createdAt.toISOString(),
  };
}

// Admin-only (caller must pass requireBuyerOrgAdmin() first — this
// re-derives the admin row itself, same defense-in-depth pattern as
// resolveBuyerOrgJoinRequest/promoteBuyerOrgMemberDirectly in
// lib/buyer-organizations.ts). Actually performs the booking/purchase —
// mirrors POST /api/bookings and POST /api/purchases' own logic (cert
// gating, overlap check, pricing resolution) since a pool-funded request
// must pass every check a directly-funded one would, just with the Stripe
// charge replaced by a pool debit (createBookingWithDebit/
// createPurchaseWithDebit's own buyerOrganizationId param) — and created
// under the REQUESTING member's account, never the admin's.
export async function fulfillBuyerOrgSpendRequest(
  actingAdminUserId: string,
  requestId: bigint
): Promise<{ request: BuyerOrgSpendRequest; booking: Booking | null; purchase: Purchase | null }> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isBuyerOrgAdmin || !admin.buyerOrganizationId) throw new NotBuyerOrgAdminError();

  const request = await prisma.buyerOrgSpendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.buyerOrganizationId !== admin.buyerOrganizationId) {
    throw new BuyerOrgSpendRequestNotFoundError();
  }
  if (request.status !== BuyerOrgSpendRequestStatus.pending) {
    throw new BuyerOrgSpendRequestNotPendingError();
  }

  const listing = await prisma.listing.findUnique({ where: { id: request.listingId } });
  if (!listing) throw new ListingNotFoundError();

  if (request.type === BuyerOrgSpendRequestType.booking) {
    const missing = await missingCertificateIds(request.listingId, request.requestedByUserId);
    if (missing.length > 0) {
      const certificates = await prisma.certificate.findMany({ where: { id: { in: missing } }, select: { name: true } });
      throw new BuyerOrgSpendRequestMissingCertificatesError(certificates.map((c) => c.name));
    }

    const bookingType = request.bookingType!;
    const priceField = PRICE_FIELD[bookingType];
    const base = listing[priceField];
    if (base === null) {
      throw new ApiValidationError({ listingId: ["This listing has no price set for that booking type."] });
    }

    const pricing = await getEffectiveCompanyPricing(listing.companyId);
    const charged = applyMarkup(base, markupPercentForBookingType(pricing, bookingType));

    const startDate = request.startDate!.toISOString().slice(0, 10);
    const endDate = request.endDate!.toISOString().slice(0, 10);
    const overlapping = await hasOverlappingBooking(request.listingId, startDate, endDate);
    if (overlapping) throw new BuyerOrgSpendRequestOverlapError();

    const booking = await createBookingWithDebit({
      userId: request.requestedByUserId,
      listingId: request.listingId,
      bookingType,
      startDate,
      endDate,
      cost: charged,
      baseAmount: base,
      commissionPercent: pricing.bookingCommissionPercent,
      requireApproval: listing.requireApproval,
      buyerOrganizationId: admin.buyerOrganizationId,
    });

    const updated = await prisma.buyerOrgSpendRequest.update({
      where: { id: request.id },
      data: {
        status: BuyerOrgSpendRequestStatus.fulfilled,
        resultingBookingId: booking.id,
        resolvedByUserId: actingAdminUserId,
        resolvedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: request.requestedByUserId,
        title: "Booking request approved",
        message: `Your organization admin approved your request — booking #${booking.id} for "${listing.name}" is confirmed via the shared pool.`,
        relatedBookingId: booking.id,
        relatedListingId: request.listingId,
      },
    });

    return { request: updated, booking, purchase: null };
  }

  if (listing.pricePerUnit === null) {
    throw new ApiValidationError({ listingId: ["This listing has no per-unit price set."] });
  }
  const quantity = request.quantity!;
  const cost = listing.pricePerUnit.mul(quantity);

  const purchase = await createPurchaseWithDebit({
    userId: request.requestedByUserId,
    listingId: request.listingId,
    quantity,
    cost,
    unitPrice: listing.pricePerUnit,
    buyerOrganizationId: admin.buyerOrganizationId,
  });

  const updated = await prisma.buyerOrgSpendRequest.update({
    where: { id: request.id },
    data: {
      status: BuyerOrgSpendRequestStatus.fulfilled,
      resultingPurchaseId: purchase.id,
      resolvedByUserId: actingAdminUserId,
      resolvedAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: request.requestedByUserId,
      title: "Purchase request approved",
      message: `Your organization admin approved your request — ${quantity}x "${listing.name}" (${sgdToCredits(Number(cost))} credits) was purchased via the shared pool.`,
      relatedListingId: request.listingId,
    },
  });

  return { request: updated, booking: null, purchase };
}

export async function declineBuyerOrgSpendRequest(
  actingAdminUserId: string,
  requestId: bigint,
  reason?: string
): Promise<BuyerOrgSpendRequest> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: actingAdminUserId } });
  if (!admin.isBuyerOrgAdmin || !admin.buyerOrganizationId) throw new NotBuyerOrgAdminError();

  const request = await prisma.buyerOrgSpendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.buyerOrganizationId !== admin.buyerOrganizationId) {
    throw new BuyerOrgSpendRequestNotFoundError();
  }
  if (request.status !== BuyerOrgSpendRequestStatus.pending) {
    throw new BuyerOrgSpendRequestNotPendingError();
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.buyerOrgSpendRequest.update({
      where: { id: request.id },
      data: {
        status: BuyerOrgSpendRequestStatus.declined,
        declineReason: reason ?? null,
        resolvedByUserId: actingAdminUserId,
        resolvedAt: new Date(),
      },
    });

    const listing = await tx.listing.findUniqueOrThrow({ where: { id: request.listingId }, select: { name: true } });
    await tx.notification.create({
      data: {
        userId: request.requestedByUserId,
        title: request.type === BuyerOrgSpendRequestType.booking ? "Booking request declined" : "Purchase request declined",
        message: reason
          ? `Your organization admin declined your request for "${listing.name}": ${reason}`
          : `Your organization admin declined your request for "${listing.name}".`,
        relatedListingId: request.listingId,
      },
    });

    return updated;
  });
}
