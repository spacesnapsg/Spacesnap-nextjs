// Sprint 6 checklist item: "Stripe webhook tested in sandbox for all states:
// success, failure, refund." Hits the real Stripe test-mode sandbox (no
// mocking, same convention as lib/bookings.test.ts) for the PaymentIntents/
// refunds these events describe, and signs synthetic webhook payloads with
// Stripe's own `generateTestHeaderString` helper — signature verification is
// a local HMAC check against STRIPE_WEBHOOK_SECRET, not a live round trip to
// Stripe, so this is a faithful test of the real verification code path
// without needing `stripe listen` or a publicly reachable endpoint.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType, TransactionType, Prisma } from "../app/generated/prisma/client";
import { stripe } from "./stripe";
import { createBookingWithDebit } from "./bookings";
import { constructStripeWebhookEvent, handleStripeWebhookEvent, StripeWebhookSignatureError } from "./stripe-webhooks";

const TEST_PAYMENT_METHOD_ID = "pm_card_visa";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function signPayload(payload: string) {
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return header;
}

function fakeEventPayload(type: string, object: Record<string, unknown>): string {
  return JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    type,
    data: { object },
  });
}

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({ data: { name: `Webhook Test Co ${Date.now()}-${companyCounter}` } });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Webhook Test User",
      email: `webhook-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Webhook Test Listing",
      priceDay: "20.00",
      priceWeek: "120.00",
      priceMonth: "400.00",
    },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

describe("constructStripeWebhookEvent — signature verification", () => {
  test("accepts a validly signed payload", () => {
    const payload = fakeEventPayload("payment_intent.succeeded", { id: "pi_fake_valid", amount: 1000, currency: "sgd" });
    const signature = signPayload(payload);
    const event = constructStripeWebhookEvent(payload, signature);
    assert.equal(event.type, "payment_intent.succeeded");
  });

  test("rejects a tampered payload (signature no longer matches)", () => {
    const payload = fakeEventPayload("payment_intent.succeeded", { id: "pi_fake_tampered", amount: 1000, currency: "sgd" });
    const signature = signPayload(payload);
    const tamperedPayload = payload.replace("1000", "999999");
    assert.throws(() => constructStripeWebhookEvent(tamperedPayload, signature), StripeWebhookSignatureError);
  });

  test("rejects a garbage signature header", () => {
    const payload = fakeEventPayload("payment_intent.succeeded", { id: "pi_fake_garbage", amount: 1000, currency: "sgd" });
    assert.throws(() => constructStripeWebhookEvent(payload, "t=1,v1=not-a-real-signature"), StripeWebhookSignatureError);
  });
});

describe("handleStripeWebhookEvent — payment_intent.succeeded reconciliation", () => {
  test("a PaymentIntent with a matching booking_payment Transaction is silently a no-op", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2029-06-01",
        endDate: "2029-06-02",
        cost: new Prisma.Decimal("20.00"),
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });
      const transaction = await prisma.transaction.findFirstOrThrow({ where: { bookingId: booking.id, type: TransactionType.booking_payment } });
      const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId!);

      const originalError = console.error;
      let errorLogged = false;
      console.error = () => {
        errorLogged = true;
      };
      try {
        await handleStripeWebhookEvent({
          id: "evt_test_reconciled",
          object: "event",
          type: "payment_intent.succeeded",
          data: { object: paymentIntent },
        } as never);
      } finally {
        console.error = originalError;
      }
      assert.equal(errorLogged, false, "an already-recorded PaymentIntent should not trigger a reconciliation warning");
    } finally {
      await prisma.transaction.deleteMany({ where: { bookingId: { not: null }, booking: { userId: user.id } } });
      await prisma.booking.deleteMany({ where: { userId: user.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a PaymentIntent with no matching Transaction row logs a reconciliation warning", async () => {
    // Simulates the real gap: Stripe charged successfully but this app never
    // wrote the corresponding Booking/Transaction (e.g. the process died
    // mid-request). Created directly via the Stripe SDK, bypassing
    // createBookingWithDebit entirely, so no row exists on purpose.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1500,
      currency: "sgd",
      payment_method: TEST_PAYMENT_METHOD_ID,
      payment_method_types: ["card"],
      confirm: true,
      description: "Webhook test — orphan PaymentIntent, no app-side Transaction",
    });

    const originalError = console.error;
    let loggedMessage: string | null = null;
    console.error = (message: string) => {
      loggedMessage = message;
    };
    try {
      await handleStripeWebhookEvent({
        id: "evt_test_orphan",
        object: "event",
        type: "payment_intent.succeeded",
        data: { object: paymentIntent },
      } as never);
    } finally {
      console.error = originalError;
    }
    assert.ok(loggedMessage, "expected a reconciliation warning to be logged");
    assert.match(loggedMessage!, /Manual reconciliation required/);
    assert.match(loggedMessage!, new RegExp(paymentIntent.id));

    await stripe.refunds.create({ payment_intent: paymentIntent.id });
  });
});

describe("handleStripeWebhookEvent — payment_intent.payment_failed", () => {
  test("logs a warning, writes nothing", async () => {
    const originalWarn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };
    try {
      await handleStripeWebhookEvent({
        id: "evt_test_failed",
        object: "event",
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_fake_failed",
            amount: 500,
            currency: "sgd",
            last_payment_error: { message: "Your card was declined." },
          },
        },
      } as never);
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(warned, true);
  });
});

describe("handleStripeWebhookEvent — charge.refunded reconciliation", () => {
  test("a fully-recorded refund matching the ledger is a silent no-op", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2029-07-20",
        endDate: "2029-07-21",
        cost: new Prisma.Decimal("20.00"),
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });
      const originalTransaction = await prisma.transaction.findFirstOrThrow({
        where: { bookingId: booking.id, type: TransactionType.booking_payment },
      });
      const paymentIntentId = originalTransaction.stripePaymentIntentId!;

      // Manually mirror what cancelBookingWithRefund would do: a real Stripe
      // refund plus a matching `refund` Transaction row, so the ledger and
      // Stripe agree.
      const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          bookingId: booking.id,
          type: TransactionType.refund,
          amount: "20.00",
          stripePaymentIntentId: paymentIntentId,
          description: "Test refund matching Stripe exactly",
        },
      });

      const charge = await stripe.charges.retrieve(refund.charge as string);

      const originalError = console.error;
      let errorLogged = false;
      console.error = () => {
        errorLogged = true;
      };
      try {
        await handleStripeWebhookEvent({
          id: "evt_test_refund_matched",
          object: "event",
          type: "charge.refunded",
          data: { object: charge },
        } as never);
      } finally {
        console.error = originalError;
      }
      assert.equal(errorLogged, false, "a refund matching the ledger exactly should not trigger a reconciliation warning");
    } finally {
      await prisma.transaction.deleteMany({ where: { bookingId: { not: null }, booking: { userId: user.id } } });
      await prisma.booking.deleteMany({ where: { userId: user.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a refund with no matching ledger row logs a reconciliation warning", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2029-08-10",
        endDate: "2029-08-11",
        cost: new Prisma.Decimal("20.00"),
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });
      const originalTransaction = await prisma.transaction.findFirstOrThrow({
        where: { bookingId: booking.id, type: TransactionType.booking_payment },
      });
      const paymentIntentId = originalTransaction.stripePaymentIntentId!;

      // A refund issued with no corresponding `refund` Transaction written —
      // simulates a Stripe-Dashboard-initiated refund this app never learns
      // about through its own request/response cycle.
      const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
      const charge = await stripe.charges.retrieve(refund.charge as string);

      const originalError = console.error;
      let loggedMessage: string | null = null;
      console.error = (message: string) => {
        loggedMessage = message;
      };
      try {
        await handleStripeWebhookEvent({
          id: "evt_test_refund_unmatched",
          object: "event",
          type: "charge.refunded",
          data: { object: charge },
        } as never);
      } finally {
        console.error = originalError;
      }
      assert.ok(loggedMessage, "expected a reconciliation warning for an unrecorded refund");
      assert.match(loggedMessage!, /Manual reconciliation required/);
    } finally {
      await prisma.transaction.deleteMany({ where: { bookingId: { not: null }, booking: { userId: user.id } } });
      await prisma.booking.deleteMany({ where: { userId: user.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a refund for a PaymentIntent with zero app-side Transactions (fully rolled-back attempt) is a silent no-op", async () => {
    // Mirrors createBookingWithDebit's own compensating-refund case: the
    // Stripe charge succeeded but the DB transaction wrapping the Booking
    // create failed and rolled back, so no Transaction row (not even the
    // original charge) was ever written. Nothing to reconcile against.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1200,
      currency: "sgd",
      payment_method: TEST_PAYMENT_METHOD_ID,
      payment_method_types: ["card"],
      confirm: true,
      description: "Webhook test — simulated rolled-back booking attempt",
    });
    const refund = await stripe.refunds.create({ payment_intent: paymentIntent.id });
    const charge = await stripe.charges.retrieve(refund.charge as string);

    const originalError = console.error;
    let errorLogged = false;
    console.error = () => {
      errorLogged = true;
    };
    try {
      await handleStripeWebhookEvent({
        id: "evt_test_refund_orphan",
        object: "event",
        type: "charge.refunded",
        data: { object: charge },
      } as never);
    } finally {
      console.error = originalError;
    }
    assert.equal(errorLogged, false, "a refund with no original ledger row at all should not be flagged — there was never a charge to reconcile");
  });
});

describe("handleStripeWebhookEvent — unhandled event types", () => {
  test("acknowledges silently instead of throwing", async () => {
    await handleStripeWebhookEvent({
      id: "evt_test_unhandled",
      object: "event",
      type: "customer.created",
      data: { object: { id: "cus_fake" } },
    } as never);
  });
});
