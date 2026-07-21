import { TransactionType, ActivityActionType, type Transaction, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { getCreditBalance } from "@/lib/credits";

// Sprint 3.5 known-gap #5, corrected scope: the sprint plan's checklist item
// says "type: purchase transactions actually created by app code" — that's
// closed by fulfillBulkOrderWithDebit (lib/bulk-orders.ts, debits on
// fulfillment) and createPurchaseWithDebit (lib/purchases.ts, "Buy Now").
// Per the Transaction model's own schema comment, topup/refund are
// credit-direction and booking/purchase are debit-direction, so a wallet
// top-up (money in) belongs on `type: topup`, not `purchase`. Grepping the
// app code confirmed TransactionType.topup was, until this file, only ever
// written by prisma/seed.ts and test fixtures — never by a real request path.
// This is the actual remaining gap: the Top Up modal (components/TopUpCreditsModal.tsx)
// has no submit handler at all, on mock data (lib/mockWallet.ts).
//
// Stripe (Sprint 6, still unbuilt — grep confirms zero Stripe SDK usage
// outside seed data) isn't wired yet, so this is credits-only for now:
// no payment is actually charged. `stripePaymentIntentId` stays null until
// Sprint 6 wires a real charge ahead of this call.
//
// 2026-07-21, same-session correction: the purchased/earned split (Sprint 2
// amendment) makes createPurchaseWithDebit (lib/purchases.ts) check
// purchasedBalance specifically, not the raw combined ledger — this write
// path was still writing the old, un-partitioned `topup` type, which meant
// no top-up could ever fund a "Buy Now" purchase going forward. Switched to
// `purchased_topup` (still counted by the combined getCreditBalance SUM
// below, since that sum has no type filter — this doesn't change what the
// wallet page displays, only what future purchasedBalance-scoped checks see).
// Not a backfill: pre-existing seeded `topup` rows are untouched.
export function parseTopUpFields(body: unknown): Prisma.Decimal {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let amount: Prisma.Decimal | null = null;
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) {
    errors.amount = ["amount must be a positive number."];
  } else {
    amount = new Prisma.Decimal(b.amount).toDecimalPlaces(2);
    if (amount.lte(0)) {
      errors.amount = ["amount must be a positive number."];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return amount!;
}

interface TopUpResult {
  transaction: Transaction;
  balance: Prisma.Decimal;
}

export async function createTopUp(userId: string, amount: Prisma.Decimal): Promise<TopUpResult> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: TransactionType.purchased_topup,
        amount,
        description: "Wallet top-up",
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        actionType: ActivityActionType.wallet_topup,
        description: `Wallet topped up with ${amount} credits.`,
      },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "credit_topup",
        title: "Credit top-up received",
        message: `$${amount.toFixed(2)} was added to your credit wallet.`,
      },
    });

    const balance = await getCreditBalance(userId, tx);

    return { transaction, balance };
  });
}

export function serializeTopUp({ transaction, balance }: TopUpResult) {
  return {
    transaction: {
      id: transaction.id.toString(),
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
    },
    balance: Number(balance),
  };
}
