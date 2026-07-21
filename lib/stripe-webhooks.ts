import Stripe from "stripe";
import { Prisma, TransactionType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Sprint 6 checklist item: "Stripe webhook tested in sandbox for all states:
// success, failure, refund." Every Stripe-charging write path in this
// codebase (createBookingWithDebit, modifyBookingWithFee,
// cancelBookingWithRefund, declineBookingWithRefund, lib/bookings.ts) already
// records its own Transaction row synchronously, in the same request that
// makes the Stripe API call — so this webhook is not the primary write path
// for any of them. Its job is the safety net those write paths can't cover
// themselves: detecting the case where a Stripe charge/refund succeeded but
// the app's own DB write never landed (process died mid-request, the
// compensating-refund catch's own refund call failed silently, a refund was
// issued outside this app entirely via the Stripe Dashboard). Every one of
// those gaps already had a `console.error("...manual reconciliation
// required")` at its own call site (see createBookingWithDebit's catch
// block) — this file gives that same manual-reconciliation posture an actual
// detection mechanism instead of only a comment.

export class StripeWebhookSignatureError extends Error {
  constructor(cause: unknown) {
    super(`Stripe webhook signature verification failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export function constructStripeWebhookEvent(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  }
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    throw new StripeWebhookSignatureError(error);
  }
}

// PaymentIntents in this codebase are only ever created for a booking's full
// charge or a reschedule's modification fee (grep-confirmed: the only two
// `stripe.paymentIntents.create` call sites are createBookingWithDebit and
// modifyBookingWithFee, both lib/bookings.ts) — so these are the only two
// Transaction types a `payment_intent.succeeded` event should ever match.
const PAYMENT_INTENT_TRANSACTION_TYPES = [TransactionType.booking_payment, TransactionType.booking_modification_fee];

async function reconcilePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const existing = await prisma.transaction.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
      type: { in: PAYMENT_INTENT_TRANSACTION_TYPES },
    },
  });

  if (existing) {
    // Expected, common case: the request that created this PaymentIntent
    // already wrote its own Transaction row synchronously. Nothing to do.
    return;
  }

  // A PaymentIntent succeeded at Stripe with no matching ledger row anywhere
  // in this app. This is the exact class of gap createBookingWithDebit's own
  // compensating-refund catch block already warns about — the customer may
  // have been charged with no corresponding booking ever recorded.
  console.error(
    `[stripe-webhook] payment_intent.succeeded for ${paymentIntent.id} (${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}) has no matching booking_payment/booking_modification_fee Transaction row. The customer may have been charged with no corresponding booking recorded. Manual reconciliation required.`
  );
}

function logPaymentIntentFailure(paymentIntent: Stripe.PaymentIntent): void {
  // createBookingWithDebit/modifyBookingWithFee both read the PaymentIntent's
  // status synchronously and throw StripeChargeFailedError before writing
  // anything if it isn't "succeeded" — so a failure never leaves a partial
  // Booking/Transaction row to roll back. This event is logged for
  // observability only (e.g. a card declined on an off-session retry Stripe
  // attempted on its own), not because there's app state to reconcile.
  console.warn(
    `[stripe-webhook] payment_intent.payment_failed for ${paymentIntent.id}: ${
      paymentIntent.last_payment_error?.message ?? "no error message from Stripe"
    }`
  );
}

async function reconcileChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent?.id ?? null);
  if (!paymentIntentId) return;

  const originalTransaction = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, type: { in: PAYMENT_INTENT_TRANSACTION_TYPES } },
  });

  if (!originalTransaction) {
    // No original charge on this app's ledger for this PaymentIntent at all —
    // this is the fully-rolled-back compensating-refund case
    // (createBookingWithDebit's catch: the Stripe charge succeeded but the DB
    // transaction that would have written the Booking + Transaction rows
    // failed and rolled back, so there was never a row to refund against in
    // the first place). Nothing to reconcile.
    return;
  }

  const refundTransactions = await prisma.transaction.findMany({
    where: { stripePaymentIntentId: paymentIntentId, type: TransactionType.refund },
  });
  const recordedRefundTotal = refundTransactions.reduce((sum, t) => sum.add(t.amount), new Prisma.Decimal(0));
  const stripeRefundTotal = new Prisma.Decimal(charge.amount_refunded).div(100);

  if (!recordedRefundTotal.equals(stripeRefundTotal)) {
    console.error(
      `[stripe-webhook] charge.refunded for PaymentIntent ${paymentIntentId}: Stripe reports ${stripeRefundTotal} SGD refunded in total, but this app's ledger only has ${recordedRefundTotal} SGD across matching "refund" Transaction rows. Possible causes: a refund issued outside this app (e.g. the Stripe Dashboard), or a refund Transaction write that failed after cancelBookingWithRefund/declineBookingWithRefund's stripe.refunds.create call already succeeded. Manual reconciliation required.`
    );
  }
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await reconcilePaymentIntentSucceeded(event.data.object);
      break;
    case "payment_intent.payment_failed":
      logPaymentIntentFailure(event.data.object);
      break;
    case "charge.refunded":
      await reconcileChargeRefunded(event.data.object);
      break;
    default:
      // Not an event type this app tracks — acknowledged, not an error, so
      // Stripe doesn't retry-storm the endpoint over types we don't handle.
      break;
  }
}
