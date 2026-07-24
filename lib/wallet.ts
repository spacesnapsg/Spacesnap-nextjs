import { TransactionType, ActivityActionType, type Transaction, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { getCreditBalance } from "@/lib/credits";
import { creditsToSgd, sgdToCredits } from "@/lib/credit-units";
import { stripe, toStripeCents, StripeChargeFailedError } from "@/lib/stripe";

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
// F4 (2026-07-25): top-ups now collect real money. A card is charged via
// Stripe before the credit is written, so `purchasedBalance` is actually
// backed by collected SGD — closing the "purchased credit represents no real
// money" gap. The client (TopUpCreditsModal) collects the card through Stripe
// Elements and sends only a `pm_...` id, exactly like the booking flow.
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
export function parseTopUpFields(body: unknown): { amount: Prisma.Decimal; paymentMethodId: string } {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let amount: Prisma.Decimal | null = null;
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) {
    errors.amount = ["amount must be a positive number."];
  } else {
    // Entered in "credits" — converted to true SGD once here, at the write
    // boundary (see lib/credit-units.ts).
    amount = new Prisma.Decimal(creditsToSgd(b.amount)).toDecimalPlaces(2);
    if (amount.lte(0)) {
      errors.amount = ["amount must be a positive number."];
    }
  }

  // A real charge is now required — a top-up with no payment method can't be
  // fulfilled (unlike the old credits-only stub that just minted credit).
  let paymentMethodId = "";
  if (typeof b.paymentMethodId !== "string" || b.paymentMethodId.trim().length === 0) {
    errors.paymentMethodId = ["paymentMethodId is required."];
  } else {
    paymentMethodId = b.paymentMethodId.trim();
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { amount: amount!, paymentMethodId };
}

interface TopUpResult {
  transaction: Transaction;
  balance: Prisma.Decimal;
}

export async function createTopUp(userId: string, amount: Prisma.Decimal, paymentMethodId: string): Promise<TopUpResult> {
  // Charge the card first, outside the DB transaction — a Stripe call can't be
  // rolled back by Prisma, so the same discipline as createBookingWithDebit
  // (lib/bookings.ts) applies: charge, verify success, then write the ledger
  // row; if the DB write then fails, issue a compensating refund.
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: toStripeCents(amount),
      currency: "sgd",
      payment_method: paymentMethodId,
      payment_method_types: ["card"],
      confirm: true,
      description: "SpaceSnap wallet top-up",
    });
  } catch (error) {
    throw new StripeChargeFailedError(error);
  }

  if (paymentIntent.status !== "succeeded") {
    throw new StripeChargeFailedError(new Error(`PaymentIntent ${paymentIntent.id} ended in status "${paymentIntent.status}".`));
  }

  const paymentIntentId = paymentIntent.id;

  try {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.purchased_topup,
          amount,
          stripePaymentIntentId: paymentIntentId,
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
          message: `${sgdToCredits(Number(amount))} credits were added to your credit wallet.`,
        },
      });

      const balance = await getCreditBalance(userId, tx);

      return { transaction, balance };
    });
  } catch (error) {
    // The charge already succeeded — don't leave the user charged with no
    // credit. Best-effort compensating refund, same shape as
    // createBookingWithDebit's catch block.
    await stripe.refunds.create({ payment_intent: paymentIntentId }).catch((refundError) => {
      console.error(
        `createTopUp: DB transaction failed AND the compensating refund also failed for PaymentIntent ${paymentIntentId}. The customer may have been charged with no credit added. Manual reconciliation required.`,
        refundError
      );
    });
    throw error;
  }
}

export function serializeTopUp({ transaction, balance }: TopUpResult) {
  return {
    transaction: {
      id: transaction.id.toString(),
      type: transaction.type,
      amount: sgdToCredits(Number(transaction.amount)),
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
    },
    balance: sgdToCredits(Number(balance)),
  };
}
