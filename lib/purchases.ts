import { TransactionType, ActivityActionType, type Purchase, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { assertSufficientBalance } from "@/lib/credits";

export function serializePurchase(purchase: Purchase) {
  return {
    id: purchase.id.toString(),
    userId: purchase.userId,
    listingId: purchase.listingId.toString(),
    quantity: purchase.quantity,
    credits: Number(purchase.credits),
    createdAt: purchase.createdAt.toISOString(),
  };
}

interface ParsedPurchaseFields {
  listingId: bigint;
  quantity: number;
}

// Same shape as parseBulkOrderCreateFields (lib/bulk-orders.ts) — "Buy Now"
// is a different completion path, not a different validation contract.
export function parsePurchaseCreateFields(body: unknown): ParsedPurchaseFields {
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

// Thrown when stock can't cover the requested quantity. No DB constraint
// backstops this (stock_quantity has no CHECK, per the listings_pricing_check
// migration only checking presence, not sign) — same posture as
// InsufficientCreditBalanceError (lib/credits.ts).
export class InsufficientStockError extends Error {
  constructor(public readonly requested: number) {
    super("Insufficient stock for this purchase.");
  }
}

interface CreatePurchaseWithDebitParams {
  userId: string;
  listingId: bigint;
  quantity: number;
  cost: Prisma.Decimal;
}

// "Buy Now" — an immediate, completed sale, deliberately not a
// BulkOrderRequest (see the Purchase model's comment in schema.prisma): a
// bulk order is a request the supplier still has to act on; this debits
// credits AND decrements stock atomically at creation, nothing left pending.
//
// The stock decrement uses updateMany with a `stockQuantity: { gte }` guard
// rather than a read-then-write — Postgres takes a row lock on the UPDATE,
// so a concurrent purchase against the same near-empty stock re-evaluates
// the gte condition against the post-commit value instead of a stale read,
// closing the overselling race the credit-balance check below still has
// (that race is a pre-existing, explicitly accepted gap — see Sprint 3.5
// Known Gap #1 in CLAUDE1.md — not something this item re-opens or fixes).
export async function createPurchaseWithDebit(params: CreatePurchaseWithDebitParams): Promise<Purchase> {
  return prisma.$transaction(async (tx) => {
    const stockUpdate = await tx.listing.updateMany({
      where: { id: params.listingId, stockQuantity: { gte: params.quantity } },
      data: { stockQuantity: { decrement: params.quantity } },
    });

    if (stockUpdate.count === 0) {
      throw new InsufficientStockError(params.quantity);
    }

    await assertSufficientBalance(tx, params.userId, params.cost);

    const purchase = await tx.purchase.create({
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
        purchaseId: purchase.id,
        type: TransactionType.purchase,
        amount: params.cost.negated(),
      },
    });

    await tx.activityLog.create({
      data: {
        userId: params.userId,
        actionType: ActivityActionType.instant_purchase_completed,
        description: `Purchased ${params.quantity} unit(s) (${params.cost} credits charged).`,
        relatedListingId: params.listingId,
      },
    });

    return purchase;
  });
}
