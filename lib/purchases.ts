import { TransactionType, ActivityActionType, RewardGrantType, type Purchase, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { assertSufficientPurchasedBalance } from "@/lib/credits";
import { resolveRewardGrantDiscount, redeemRewardGrant, RewardGrantNotRedeemableError } from "@/lib/reward-grants";

export { RewardGrantNotRedeemableError };

export function serializePurchase(purchase: Purchase) {
  return {
    id: purchase.id.toString(),
    userId: purchase.userId,
    listingId: purchase.listingId.toString(),
    quantity: purchase.quantity,
    credits: Number(purchase.credits),
    earnedCreditsApplied: Number(purchase.earnedCreditsApplied),
    createdAt: purchase.createdAt.toISOString(),
  };
}

interface ParsedPurchaseFields {
  listingId: bigint;
  quantity: number;
  rewardGrantId?: bigint;
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

  // 2026-07-21: optional discount, resolved server-side against a specific
  // RewardGrant (type free_consumable_unit) — see createPurchaseWithDebit.
  let rewardGrantId: bigint | undefined;
  if (b.rewardGrantId !== undefined && b.rewardGrantId !== null) {
    const rawGrantId = typeof b.rewardGrantId === "number" ? String(b.rewardGrantId) : b.rewardGrantId;
    if (typeof rawGrantId !== "string" || !/^\d+$/.test(rawGrantId)) {
      errors.rewardGrantId = ["rewardGrantId must be an id."];
    } else {
      rewardGrantId = BigInt(rawGrantId);
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return {
    listingId: listingId!,
    quantity: b.quantity as number,
    rewardGrantId,
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
  unitPrice: Prisma.Decimal;
  rewardGrantId?: bigint;
}

// "Buy Now" — an immediate, completed sale, deliberately not a
// BulkOrderRequest (see the Purchase model's comment in schema.prisma): a
// bulk order is a request the supplier still has to act on; this debits
// purchasedBalance AND decrements stock atomically at creation, nothing left
// pending.
//
// The stock decrement uses updateMany with a `stockQuantity: { gte }` guard
// rather than a read-then-write — Postgres takes a row lock on the UPDATE,
// so a concurrent purchase against the same near-empty stock re-evaluates
// the gte condition against the post-commit value instead of a stale read,
// closing the overselling race the credit-balance check below still has
// (that race is a pre-existing, explicitly accepted gap — see Sprint 3.5
// Known Gap #1 in CLAUDE1.md — not something this item re-opens or fixes).
//
// 2026-07-21 write-path session: `credits` still covers the full price via
// purchasedBalance (TransactionType.purchased_spend, replacing the old
// combined-ledger `purchase` type — see Purchase's schema comment); an
// optional discount is resolved by redeeming a specific RewardGrant (type
// free_consumable_unit), never a client-supplied amount, same discipline as
// the booking flow (lib/bookings.ts). Unlike bookings, this stays
// purchasedBalance-funded — no Stripe call here, see Purchase's schema
// comment for why the compliance boundary doesn't require one.
export async function createPurchaseWithDebit(params: CreatePurchaseWithDebitParams): Promise<Purchase> {
  let discount = new Prisma.Decimal(0);
  let grantId: bigint | null = null;

  if (params.rewardGrantId !== undefined) {
    const resolved = await resolveRewardGrantDiscount(
      params.userId,
      params.rewardGrantId,
      RewardGrantType.free_consumable_unit,
      params.cost,
      params.unitPrice
    );
    discount = resolved.discount;
    grantId = resolved.grant.id;
  }

  const chargeAmount = params.cost.sub(discount);

  return prisma.$transaction(async (tx) => {
    const stockUpdate = await tx.listing.updateMany({
      where: { id: params.listingId, stockQuantity: { gte: params.quantity } },
      data: { stockQuantity: { decrement: params.quantity } },
    });

    if (stockUpdate.count === 0) {
      throw new InsufficientStockError(params.quantity);
    }

    await assertSufficientPurchasedBalance(tx, params.userId, chargeAmount);

    const purchase = await tx.purchase.create({
      data: {
        userId: params.userId,
        listingId: params.listingId,
        quantity: params.quantity,
        credits: params.cost,
        earnedCreditsApplied: discount,
      },
    });

    if (grantId !== null && discount.gt(0)) {
      await redeemRewardGrant(tx, grantId);
      await tx.transaction.create({
        data: {
          userId: params.userId,
          purchaseId: purchase.id,
          rewardGrantId: grantId,
          type: TransactionType.earned_spend,
          amount: discount.negated(),
          description: `Purchase #${purchase.id} — reward grant #${grantId} redeemed for a ${discount} SGD discount.`,
        },
      });
    }

    await tx.transaction.create({
      data: {
        userId: params.userId,
        purchaseId: purchase.id,
        type: TransactionType.purchased_spend,
        amount: chargeAmount.negated(),
        description: `Purchase #${purchase.id} — ${chargeAmount} SGD debited from purchasedBalance.`,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: params.userId,
        actionType: ActivityActionType.instant_purchase_completed,
        description: discount.gt(0)
          ? `Purchased ${params.quantity} unit(s) (${chargeAmount} credits charged, ${discount} reward discount applied).`
          : `Purchased ${params.quantity} unit(s) (${chargeAmount} credits charged).`,
        relatedListingId: params.listingId,
      },
    });

    return purchase;
  });
}
