import { TransactionType, ActivityActionType, BulkOrderStatus, type BulkOrderRequest, type Listing, type User, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { assertSufficientBalance } from "@/lib/credits";
import { createHold, releaseHoldForBulkOrder, getAvailableCreditBalance, InsufficientAvailableCreditError } from "@/lib/credit-holds";
import { sgdToCredits } from "@/lib/credit-units";

export const bulkOrderRequestWithRelationsArgs = {
  include: { listing: true, user: true },
} satisfies Prisma.BulkOrderRequestDefaultArgs;

export type BulkOrderRequestWithRelations = BulkOrderRequest & { listing: Listing; user: User };

// Mirrors old SupplierBulkOrderController::transform's shape (listing_name,
// requester_name, requester_email) for the supplier-facing list — the
// `listing`/`user` relations are only present when the caller included them.
export function serializeBulkOrderRequest(request: BulkOrderRequest | BulkOrderRequestWithRelations) {
  return {
    id: request.id.toString(),
    userId: request.userId,
    listingId: request.listingId.toString(),
    quantity: request.quantity,
    credits: sgdToCredits(Number(request.credits)),
    status: request.status,
    estimatedDeliveryDate: request.estimatedDeliveryDate ? request.estimatedDeliveryDate.toISOString().slice(0, 10) : null,
    cancellationRequestedAt: request.cancellationRequestedAt ? request.cancellationRequestedAt.toISOString() : null,
    cancellationReason: request.cancellationReason,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    ...("listing" in request ? { listingName: request.listing.name } : {}),
    ...("user" in request ? { userName: request.user.name, userEmail: request.user.email } : {}),
  };
}

interface ParsedBulkOrderFields {
  listingId: bigint;
  quantity: number;
}

// Mirrors old BulkOrderRequestController::store's validation rules
// (listing_id required+exists, quantity required integer min:1).
export function parseBulkOrderCreateFields(body: unknown): ParsedBulkOrderFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let listingId: bigint | null = null;
  const rawListingId = typeof b.listingId === "number" ? String(b.listingId) : b.listingId;
  if (typeof rawListingId !== "string" || !/^\d+$/.test(rawListingId)) {
    errors.listingId = ["listingId is required."];
  } else {
    listingId = BigInt(rawListingId);
  }

  if (typeof b.quantity !== "number" || !Number.isInteger(b.quantity) || b.quantity < 1) {
    errors.quantity = ["quantity must be an integer of at least 1."];
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return {
    listingId: listingId!,
    quantity: b.quantity as number,
  };
}

// Required on every confirm (2026-07-20 product owner request) — plain
// YYYY-MM-DD, stored as a UTC midnight Date. No "week" type on either side;
// the supplier picks any date and the UI labels/formats it as a week.
export function parseEstimatedDeliveryDate(body: unknown): Date {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const raw = b.estimatedDeliveryDate;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ApiValidationError({ estimatedDeliveryDate: ["estimatedDeliveryDate is required (YYYY-MM-DD)."] });
  }
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiValidationError({ estimatedDeliveryDate: ["estimatedDeliveryDate must be a valid date."] });
  }
  return date;
}

interface ParsedCancellationRequestFields {
  reason: string;
}

export function parseCancellationRequestFields(body: unknown): ParsedCancellationRequestFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let reason = "";
  if (typeof b.reason !== "string" || b.reason.trim().length === 0) {
    errors.reason = ["reason is required."];
  } else {
    reason = b.reason.trim();
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { reason };
}

interface CreateBulkOrderParams {
  userId: string;
  listingId: bigint;
  quantity: number;
  cost: Prisma.Decimal;
}

// Corrected 2026-07-20 (product owner): credits are NOT debited at request
// creation. This matches the old BulkOrderRequestController::store exactly —
// no balance check, no Transaction, just the row. Credits only move when the
// supplier fulfills the order (fulfillBulkOrderWithDebit below). An earlier
// session had this debiting at creation on the assumption that was an
// improvement over the old build; that assumption was wrong and has been
// reverted. See CLAUDE1.md correction note, same date.
export async function createBulkOrder(params: CreateBulkOrderParams): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const bulkOrderRequest = await tx.bulkOrderRequest.create({
      data: {
        userId: params.userId,
        listingId: params.listingId,
        quantity: params.quantity,
        credits: params.cost,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: params.userId,
        actionType: ActivityActionType.bulk_order_created,
        description: `Bulk order #${bulkOrderRequest.id} requested for ${params.quantity} unit(s) (${params.cost} credits, due on fulfillment).`,
        relatedListingId: params.listingId,
      },
    });

    return bulkOrderRequest;
  });
}

export class BulkOrderNotConfirmableError extends Error {
  constructor(public readonly status: BulkOrderStatus) {
    super(`Bulk order is already ${status} and cannot be confirmed.`);
  }
}

// No credit movement at confirm — the real debit still only happens at
// fulfillment (fulfillBulkOrderWithDebit). What confirm *does* do, since the
// credit-hold feature (2026-07-20 product owner scope): place a CreditHold
// for the request's cost, checked against the buyer's *available* balance
// (live balance minus their other active holds), so a supplier can't
// unknowingly confirm an order the buyer can no longer afford by the time it
// reaches fulfillment. This isn't a hard gate, though — if available balance
// is short and `override` isn't set, confirm throws
// InsufficientAvailableCreditError (no write happens, transaction rolls
// back) so the route can surface a warning; the supplier can then resubmit
// with `override: true` to confirm anyway, which still places the hold and
// additionally logs a distinct activity-log entry so there's an audit trail
// for "confirmed despite insufficient credit," not just a silent override.
// `estimatedDeliveryDate` is required (2026-07-20 product owner request) —
// enforced by parseEstimatedDeliveryDate at the route layer, not re-validated
// here.
export async function confirmBulkOrder(
  bulkOrderRequestId: bigint,
  estimatedDeliveryDate: Date,
  options: { override?: boolean } = {}
): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bulkOrderRequest.findUniqueOrThrow({ where: { id: bulkOrderRequestId } });
    if (request.status !== BulkOrderStatus.pending) {
      throw new BulkOrderNotConfirmableError(request.status);
    }

    const { available } = await getAvailableCreditBalance(request.userId, tx);
    const isOverride = available.lt(request.credits);
    if (isOverride && !options.override) {
      throw new InsufficientAvailableCreditError(available, request.credits);
    }

    const updated = await tx.bulkOrderRequest.update({
      where: { id: bulkOrderRequestId },
      data: { status: BulkOrderStatus.confirmed, estimatedDeliveryDate },
    });

    await createHold(tx, { userId: updated.userId, bulkOrderRequestId: updated.id, amount: updated.credits });

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.bulk_order_confirmed,
        description: `Bulk order #${updated.id} confirmed by supplier (estimated delivery ${estimatedDeliveryDate.toISOString().slice(0, 10)}); ${updated.credits} credits held.`,
        relatedListingId: updated.listingId,
      },
    });

    if (isOverride) {
      await tx.activityLog.create({
        data: {
          userId: updated.userId,
          actionType: ActivityActionType.bulk_order_confirmed_despite_insufficient_credit,
          description: `Supplier confirmed bulk order #${updated.id} despite insufficient available credit (${available} available, ${updated.credits} required).`,
          relatedListingId: updated.listingId,
        },
      });
    }

    return updated;
  });
}

export class BulkOrderNotDeclinableError extends Error {
  constructor(public readonly status: BulkOrderStatus) {
    super(`Bulk order is already ${status} and cannot be declined.`);
  }
}

// No refund path needed (unlike declineBookingPendingResolution) — nothing was ever
// debited for a pending/confirmed bulk order. Releases the hold if declining
// from `confirmed` (a `pending` decline never had one — releaseHoldForBulkOrder
// is a no-op in that case).
export async function declineBulkOrder(bulkOrderRequestId: bigint): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bulkOrderRequest.findUniqueOrThrow({ where: { id: bulkOrderRequestId } });
    if (request.status !== BulkOrderStatus.pending && request.status !== BulkOrderStatus.confirmed) {
      throw new BulkOrderNotDeclinableError(request.status);
    }

    await releaseHoldForBulkOrder(tx, bulkOrderRequestId);

    const updated = await tx.bulkOrderRequest.update({
      where: { id: bulkOrderRequestId },
      data: { status: BulkOrderStatus.cancelled },
    });

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.bulk_order_declined,
        description: `Bulk order #${updated.id} declined by supplier (no credits were debited, nothing to refund).`,
        relatedListingId: updated.listingId,
      },
    });

    return updated;
  });
}

export class BulkOrderNotFulfillableError extends Error {
  constructor(public readonly status: BulkOrderStatus) {
    super(`Bulk order is already ${status} and cannot be fulfilled.`);
  }
}

// This is where credits actually move. Mirrors old
// SupplierBulkOrderController::update's `fulfilled` branch: balance is
// checked against the request's stored `credits` (the price snapshot taken
// at creation, not the listing's possibly-changed current price), a single
// debit Transaction is created, and status flips to fulfilled — all atomic.
// `type: purchase` on the Transaction row matches the type
// createPurchaseWithDebit ("Buy Now") already uses for the same kind of
// debit event. Still checks the real (non-hold) balance here, deliberately —
// the hold placed at confirm only ever gated the *confirm* decision; whether
// the debit can actually go through is always re-checked against the live
// ledger balance at the moment fulfillment happens, same as before the hold
// feature existed. Releases the request's hold either way (a pending request
// — one that skipped confirm — never had a hold to release, and
// releaseHoldForBulkOrder is a no-op when there's nothing active).
export async function fulfillBulkOrderWithDebit(bulkOrderRequestId: bigint): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bulkOrderRequest.findUniqueOrThrow({ where: { id: bulkOrderRequestId } });
    if (request.status !== BulkOrderStatus.pending && request.status !== BulkOrderStatus.confirmed) {
      throw new BulkOrderNotFulfillableError(request.status);
    }

    await assertSufficientBalance(tx, request.userId, request.credits);
    await releaseHoldForBulkOrder(tx, bulkOrderRequestId);

    const updated = await tx.bulkOrderRequest.update({
      where: { id: bulkOrderRequestId },
      data: { status: BulkOrderStatus.fulfilled },
    });

    await tx.transaction.create({
      data: {
        userId: updated.userId,
        bulkOrderRequestId: updated.id,
        type: TransactionType.purchase,
        amount: updated.credits.negated(),
        description: `Bulk order #${updated.id} fulfilled — ${updated.credits} credits debited.`,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.bulk_order_fulfilled,
        description: `Bulk order #${updated.id} fulfilled (${updated.credits} credits debited).`,
        relatedListingId: updated.listingId,
      },
    });

    return updated;
  });
}

// Thrown by every buyer-initiated action below when the request doesn't
// belong to the caller — deliberately also covers "doesn't exist" (mirrors
// BookingNotOwnedError, lib/ratings.ts) so a route can map it straight to a
// 404 without leaking whether the id exists for someone else.
export class BulkOrderNotOwnedError extends Error {
  constructor() {
    super("This bulk order request does not belong to you.");
  }
}

export class BulkOrderNotCancellableError extends Error {
  constructor(public readonly status: BulkOrderStatus) {
    super(
      status === BulkOrderStatus.confirmed
        ? "This order has already been confirmed — request cancellation instead so the supplier can review it."
        : `Bulk order is already ${status} and cannot be cancelled.`
    );
  }
}

// Buyer-initiated, immediate — only while still `pending`. 2026-07-20 product
// owner decision: a request the supplier hasn't acted on yet can be pulled
// by the buyer with no review step (mirrors declineBulkOrder's "no refund
// needed, nothing was ever debited" shape); once `confirmed`, the supplier
// has already committed to it, so the buyer can only
// requestBulkOrderCancellation below.
export async function cancelBulkOrderByUser(bulkOrderRequestId: bigint, userId: string): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bulkOrderRequest.findUnique({ where: { id: bulkOrderRequestId } });
    if (!request || request.userId !== userId) {
      throw new BulkOrderNotOwnedError();
    }
    if (request.status !== BulkOrderStatus.pending) {
      throw new BulkOrderNotCancellableError(request.status);
    }

    const updated = await tx.bulkOrderRequest.update({
      where: { id: bulkOrderRequestId },
      data: { status: BulkOrderStatus.cancelled },
    });

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.bulk_order_cancelled,
        description: `Bulk order #${updated.id} cancelled by the requester before supplier confirmation (no credits were debited, nothing to refund).`,
        relatedListingId: updated.listingId,
      },
    });

    return updated;
  });
}

export class BulkOrderCancellationNotRequestableError extends Error {}

// Buyer-initiated, requires supplier review — only while `confirmed`, and
// only one open request at a time. 2026-07-20 product owner decision.
export async function requestBulkOrderCancellation(
  bulkOrderRequestId: bigint,
  userId: string,
  reason: string
): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bulkOrderRequest.findUnique({ where: { id: bulkOrderRequestId } });
    if (!request || request.userId !== userId) {
      throw new BulkOrderNotOwnedError();
    }
    if (request.status === BulkOrderStatus.pending) {
      throw new BulkOrderCancellationNotRequestableError(
        "This request hasn't been confirmed yet — cancel it directly instead of requesting cancellation."
      );
    }
    if (request.status !== BulkOrderStatus.confirmed) {
      throw new BulkOrderCancellationNotRequestableError(`Bulk order is already ${request.status} and cannot be cancelled.`);
    }
    if (request.cancellationRequestedAt) {
      throw new BulkOrderCancellationNotRequestableError("A cancellation request is already pending supplier review.");
    }

    const updated = await tx.bulkOrderRequest.update({
      where: { id: bulkOrderRequestId },
      data: { cancellationRequestedAt: new Date(), cancellationReason: reason },
    });

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.bulk_order_cancellation_requested,
        description: `Cancellation requested for bulk order #${updated.id}: "${reason}"`,
        relatedListingId: updated.listingId,
      },
    });

    return updated;
  });
}

export class BulkOrderCancellationNotPendingError extends Error {
  constructor() {
    super("There is no pending cancellation request on this bulk order.");
  }
}

// Only reachable from `confirmed` (see requestBulkOrderCancellation's own
// status guard), so there's always an active hold to release here.
export async function approveBulkOrderCancellation(bulkOrderRequestId: bigint): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bulkOrderRequest.findUniqueOrThrow({ where: { id: bulkOrderRequestId } });
    if (!request.cancellationRequestedAt) {
      throw new BulkOrderCancellationNotPendingError();
    }

    await releaseHoldForBulkOrder(tx, bulkOrderRequestId);

    const updated = await tx.bulkOrderRequest.update({
      where: { id: bulkOrderRequestId },
      data: { status: BulkOrderStatus.cancelled, cancellationRequestedAt: null, cancellationReason: null },
    });

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.bulk_order_cancellation_approved,
        description: `Supplier approved the cancellation request for bulk order #${updated.id} (no credits were debited, nothing to refund).`,
        relatedListingId: updated.listingId,
      },
    });

    return updated;
  });
}

export async function rejectBulkOrderCancellation(bulkOrderRequestId: bigint): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bulkOrderRequest.findUniqueOrThrow({ where: { id: bulkOrderRequestId } });
    if (!request.cancellationRequestedAt) {
      throw new BulkOrderCancellationNotPendingError();
    }

    const updated = await tx.bulkOrderRequest.update({
      where: { id: bulkOrderRequestId },
      data: { cancellationRequestedAt: null, cancellationReason: null },
    });

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.bulk_order_cancellation_rejected,
        description: `Supplier rejected the cancellation request for bulk order #${updated.id}; the order remains confirmed.`,
        relatedListingId: updated.listingId,
      },
    });

    return updated;
  });
}
