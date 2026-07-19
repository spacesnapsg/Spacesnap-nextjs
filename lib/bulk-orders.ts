import { TransactionType, type BulkOrderRequest, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { assertSufficientBalance } from "@/lib/credits";

export function serializeBulkOrderRequest(request: BulkOrderRequest) {
  return {
    id: request.id.toString(),
    userId: request.userId,
    listingId: request.listingId.toString(),
    quantity: request.quantity,
    credits: Number(request.credits),
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
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

interface CreateBulkOrderWithDebitParams {
  userId: string;
  listingId: bigint;
  quantity: number;
  cost: Prisma.Decimal;
}

// Sprint 3.5 known-gap #4: same "check balance, debit, create Transaction"
// pattern as createBookingWithDebit (lib/bookings.ts), reusing the shared
// assertSufficientBalance helper (lib/credits.ts) instead of reimplementing
// the check inline. Unlike the old build (SupplierBulkOrderController only
// deducted credits on transition to `fulfilled`), this rewrite debits at
// request creation — the same point bookings debit at — so the balance
// check, BulkOrderRequest insert, and debit Transaction all land atomically
// in one DB transaction here too. `type: purchase` on the Transaction row
// also closes the separate "type: purchase never created by real app code"
// gap noted in CODEBASEAPI_SUMMARY.md §6.
export async function createBulkOrderWithDebit(params: CreateBulkOrderWithDebitParams): Promise<BulkOrderRequest> {
  return prisma.$transaction(async (tx) => {
    await assertSufficientBalance(tx, params.userId, params.cost);

    const bulkOrderRequest = await tx.bulkOrderRequest.create({
      data: {
        userId: params.userId,
        listingId: params.listingId,
        quantity: params.quantity,
        credits: params.cost,
      },
    });

    await tx.transaction.create({
      data: {
        userId: params.userId,
        bulkOrderRequestId: bulkOrderRequest.id,
        type: TransactionType.purchase,
        amount: params.cost.negated(),
      },
    });

    return bulkOrderRequest;
  });
}
