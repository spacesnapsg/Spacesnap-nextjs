// Coverage for the app-layer overlap pre-check (Sprint 4, Item 3), the
// counterpart to the DB-level bookings_no_overlap exclusion constraint
// covered in prisma/tests/db-constraints.test.ts. Hits the real dev Postgres
// DB through Prisma (no mocking) since this function's whole job is to mirror
// that constraint's date-range/status semantics ahead of the insert.
//
// 2026-07-21 write-path session: createBookingWithDebit now makes a real
// Stripe test-mode API call per booking (no mocking, same "hit the real
// backing service" convention this file already uses for Postgres) — see
// lib/stripe.ts. `pm_card_visa`/`pm_card_chargeDeclined` are Stripe's own
// well-known static test PaymentMethod ids, safe to reuse across test runs.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType, TransactionType, RewardGrantType } from "../app/generated/prisma/client";
import { getCreditBalance } from "./credits";
import {
  hasOverlappingBooking,
  createBookingWithDebit,
  confirmBookingWithAudit,
  BookingNotConfirmableError,
  declineBookingWithRefund,
  BookingNotDeclinableError,
  cancelBookingWithRefund,
  BookingNotCancellableError,
  StripeChargeFailedError,
  RewardGrantNotRedeemableError,
} from "./bookings";

const TEST_PAYMENT_METHOD_ID = "pm_card_visa";
const TEST_DECLINED_PAYMENT_METHOD_ID = "pm_card_chargeDeclined";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Overlap Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Overlap Test User",
      email: `overlap-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Overlap Test Listing",
      priceDay: "10.00",
      priceWeek: "60.00",
      priceMonth: "200.00",
    },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

describe("hasOverlappingBooking (app-layer mirror of bookings_no_overlap)", () => {
  test("detects an overlap against an existing active booking on the same listing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-03-01"),
          endDate: new Date("2027-03-05"),
          sgdAmount: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-03-03", "2027-03-07");
      assert.equal(result, true);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("inclusive date bounds: a booking sharing only the boundary day still overlaps", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-04-01"),
          endDate: new Date("2027-04-05"),
          sgdAmount: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-04-05", "2027-04-10");
      assert.equal(result, true);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("returns false for genuinely non-overlapping dates on the same listing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-05-01"),
          endDate: new Date("2027-05-05"),
          sgdAmount: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-05-06", "2027-05-10");
      assert.equal(result, false);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a cancelled booking does not block the slot", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-06-01"),
          endDate: new Date("2027-06-05"),
          sgdAmount: "10.00",
          status: "cancelled",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-06-02", "2027-06-04");
      assert.equal(result, false);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("overlap on one listing does not block a different listing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listingA = await createSpaceListing(company.id);
      const listingB = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listingA.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-07-01"),
          endDate: new Date("2027-07-05"),
          sgdAmount: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listingB.id, "2027-07-02", "2027-07-04");
      assert.equal(result, false);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// Coverage for the 2026-07-21 write-path rewrite: createBookingWithDebit no
// longer checks or debits any wallet balance for a booking — it charges the
// full (or reward-discounted) amount in real-time SGD via a Stripe
// PaymentIntent, created before the DB transaction opens, then writes the
// Booking + booking_payment Transaction (+ earned_spend Transaction if a
// RewardGrant was redeemed) atomically. See createBookingWithDebit's own
// comment in lib/bookings.ts for the ordering rationale.
describe("createBookingWithDebit (2026-07-21, Stripe charge + RewardGrant discount)", () => {
  test("charges the full cost via Stripe and writes exactly one booking_payment Transaction row, with no reward discount", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-09-03",
        endDate: "2027-09-03",
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      assert.equal(booking.sgdAmount.toString(), "10");
      assert.equal(booking.earnedCreditsApplied.toString(), "0");

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.booking_payment);
      assert.equal(transactions[0].amount.toString(), "-10");
      assert.ok(transactions[0].stripePaymentIntentId);

      // A booking charged directly via Stripe never moves the combined
      // ledger sum on its own (no topup involved) — booking_payment amounts
      // are still summed by getCreditBalance's blind SUM (it has no type
      // filter), so a user with zero prior activity ends up with a negative
      // combined figure. That combined figure is a legacy concept being
      // phased out in favor of purchasedBalance/earnedBalance (see
      // lib/credits.ts) — asserted here only to document the actual
      // behavior, not to claim it's the meaningful number going forward.
      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "-10");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects with StripeChargeFailedError when the card is declined, and writes no booking or Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);

      await assert.rejects(
        () =>
          createBookingWithDebit({
            userId: user.id,
            listingId: listing.id,
            bookingType: BookingType.daily,
            startDate: "2027-09-04",
            endDate: "2027-09-04",
            cost: listing.priceDay!,
            paymentMethodId: TEST_DECLINED_PAYMENT_METHOD_ID,
          }),
        StripeChargeFailedError
      );

      const bookings = await prisma.booking.findMany({ where: { userId: user.id } });
      assert.equal(bookings.length, 0);
      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a lost double-booking race (DB exclusion constraint) rejects cleanly with no orphan booking or Transaction, after the Stripe charge had already succeeded", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);

      const first = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-09-05",
        endDate: "2027-09-07",
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      // Same listing, overlapping dates — hasOverlappingBooking is a route
      // pre-check, not enforced by createBookingWithDebit itself, so calling
      // this directly (bypassing the route) exercises the DB's
      // bookings_no_overlap EXCLUDE constraint as the actual backstop, and
      // this function's compensating-refund catch block along with it.
      await assert.rejects(() =>
        createBookingWithDebit({
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: "2027-09-06",
          endDate: "2027-09-08",
          cost: listing.priceDay!,
          paymentMethodId: TEST_PAYMENT_METHOD_ID,
        })
      );

      const bookings = await prisma.booking.findMany({ where: { listingId: listing.id } });
      assert.equal(bookings.length, 1);
      assert.equal(bookings[0].id.toString(), first.id.toString());

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 1); // only the first booking's charge, nothing orphaned from the second
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// 2026-07-21 — RewardGrant (booking_discount_pct) redemption against a
// booking's discount line (Booking.earnedCreditsApplied). No issuance flow
// exists yet, so grants are seeded directly via prisma, same as every other
// fixture in this file.
describe("createBookingWithDebit — RewardGrant (booking_discount_pct) redemption", () => {
  test("resolves a percentage grant's discount, charges Stripe for the net amount, marks the grant redeemed, and writes an earned_spend Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.booking_discount_pct, value: "20", grantedVia: "test-fixture" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-09-09",
        endDate: "2027-09-09",
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
        rewardGrantId: grant.id,
      });

      // 20% off 10.00 = 2.00 discount; Stripe charged for 8.00.
      assert.equal(booking.sgdAmount.toString(), "10");
      assert.equal(booking.earnedCreditsApplied.toString(), "2");

      const grantAfter = await prisma.rewardGrant.findUnique({ where: { id: grant.id } });
      assert.equal(grantAfter!.status, "redeemed");
      assert.ok(grantAfter!.redeemedAt);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 2);
      const payment = transactions.find((t) => t.type === TransactionType.booking_payment);
      assert.ok(payment);
      assert.equal(payment!.amount.toString(), "-8");
      const earnedSpend = transactions.find((t) => t.type === TransactionType.earned_spend);
      assert.ok(earnedSpend);
      assert.equal(earnedSpend!.amount.toString(), "-2");
      assert.equal(earnedSpend!.rewardGrantId?.toString(), grant.id.toString());
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects an already-redeemed grant before ever calling Stripe, and writes nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const grant = await prisma.rewardGrant.create({
        data: {
          userId: user.id,
          type: RewardGrantType.booking_discount_pct,
          value: "20",
          status: "redeemed",
          redeemedAt: new Date(),
          grantedVia: "test-fixture",
        },
      });

      await assert.rejects(
        () =>
          createBookingWithDebit({
            userId: user.id,
            listingId: listing.id,
            bookingType: BookingType.daily,
            startDate: "2027-09-10",
            endDate: "2027-09-10",
            cost: listing.priceDay!,
            paymentMethodId: TEST_PAYMENT_METHOD_ID,
            rewardGrantId: grant.id,
          }),
        RewardGrantNotRedeemableError
      );

      const bookings = await prisma.booking.findMany({ where: { userId: user.id } });
      assert.equal(bookings.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects a grant belonging to a different user", async () => {
    const company = await createCompany();
    const user = await createUser();
    const otherUser = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const grant = await prisma.rewardGrant.create({
        data: { userId: otherUser.id, type: RewardGrantType.booking_discount_pct, value: "20", grantedVia: "test-fixture" },
      });

      await assert.rejects(
        () =>
          createBookingWithDebit({
            userId: user.id,
            listingId: listing.id,
            bookingType: BookingType.daily,
            startDate: "2027-09-11",
            endDate: "2027-09-11",
            cost: listing.priceDay!,
            paymentMethodId: TEST_PAYMENT_METHOD_ID,
            rewardGrantId: grant.id,
          }),
        RewardGrantNotRedeemableError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id, otherUser.id]);
    }
  });

  test("rejects a free_consumable_unit grant (wrong type for a booking)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.free_consumable_unit, value: "1", grantedVia: "test-fixture" },
      });

      await assert.rejects(
        () =>
          createBookingWithDebit({
            userId: user.id,
            listingId: listing.id,
            bookingType: BookingType.daily,
            startDate: "2027-09-12",
            endDate: "2027-09-12",
            cost: listing.priceDay!,
            paymentMethodId: TEST_PAYMENT_METHOD_ID,
            rewardGrantId: grant.id,
          }),
        RewardGrantNotRedeemableError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("clamps a grant worth more than the booking cost to 100%, never issuing a net credit or a negative Stripe charge", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.booking_discount_pct, value: "150", grantedVia: "test-fixture" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-09-13",
        endDate: "2027-09-13",
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
        rewardGrantId: grant.id,
      });

      assert.equal(booking.earnedCreditsApplied.toString(), "10"); // clamped to the full cost, not 15

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      const payment = transactions.find((t) => t.type === TransactionType.booking_payment);
      assert.equal(payment!.amount.toString(), "0"); // a fully-discounted booking still records a zero-amount Stripe charge for audit parity
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// Coverage for the Sprint 3.5 ledger gap #2: confirm's own audit-trail row.
// Credits are already fully debited at booking creation (createBookingWithDebit
// above, in both this design and the old Laravel build) — so confirm writes a
// zero-amount Transaction rather than a second debit, and must never write a
// second row when called against a booking that isn't `pending`.
describe("confirmBookingWithAudit (Sprint 3.5, known gap #2)", () => {
  test("confirms a pending booking and writes exactly one zero-amount audit Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-10-01"),
          endDate: new Date("2027-10-01"),
          sgdAmount: "10.00",
        },
      });

      const updated = await confirmBookingWithAudit(booking.id);
      assert.equal(updated.status, "confirmed");

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.booking);
      assert.equal(transactions[0].amount.toString(), "0");
      assert.equal(transactions[0].userId, user.id);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("confirming an already-confirmed booking rejects cleanly, no duplicate Transaction written", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-10-02"),
          endDate: new Date("2027-10-02"),
          sgdAmount: "10.00",
        },
      });

      await confirmBookingWithAudit(booking.id);

      await assert.rejects(() => confirmBookingWithAudit(booking.id), BookingNotConfirmableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("confirming a cancelled booking rejects cleanly and writes no orphan Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-10-03"),
          endDate: new Date("2027-10-03"),
          sgdAmount: "10.00",
          status: "cancelled",
        },
      });

      await assert.rejects(() => confirmBookingWithAudit(booking.id), BookingNotConfirmableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 0);

      const bookingRow = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(bookingRow!.status, "cancelled");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// Coverage for the Sprint 3.5 ledger gap #3: decline needs to refund the
// credits debited at creation. Per CLAUDE1.md's read of the old build, the
// old code summed the booking's debit Transactions and refunded that; this
// design instead reads the refund amount straight off the Booking row's
// stored `sgdAmount` field, so a price change on the listing after booking
// creation can't skew the refund.
describe("declineBookingWithRefund (Sprint 3.5, known gap #3)", () => {
  test("declines a pending booking, refunds exactly the amount debited at creation, and writes exactly one refund Transaction row", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      // Establishes a baseline combined-ledger balance so the refund
      // arithmetic below is visible — createBookingWithDebit no longer
      // requires or checks any wallet balance to succeed (it charges Stripe
      // directly), this topup is purely for the assertion's readability.
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "50.00" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-11-01",
        endDate: "2027-11-01",
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      const balanceAfterBooking = await getCreditBalance(user.id);
      assert.equal(balanceAfterBooking.toString(), "40");

      const updated = await declineBookingWithRefund(booking.id);
      assert.equal(updated.status, "cancelled");

      const balanceAfterDecline = await getCreditBalance(user.id);
      assert.equal(balanceAfterDecline.toString(), "50");

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 2); // the create-time debit + the decline refund
      const refunds = transactions.filter((t) => t.type === TransactionType.refund);
      assert.equal(refunds.length, 1);
      assert.equal(refunds[0].amount.toString(), "10");
      assert.equal(refunds[0].userId, user.id);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a confirmed booking can still be declined and refunded", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "10.00" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-11-02",
        endDate: "2027-11-02",
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });
      await confirmBookingWithAudit(booking.id);

      const updated = await declineBookingWithRefund(booking.id);
      assert.equal(updated.status, "cancelled");

      const balanceAfterDecline = await getCreditBalance(user.id);
      assert.equal(balanceAfterDecline.toString(), "10");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("declining an already-cancelled booking rejects cleanly and does not touch the ledger", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-11-03"),
          endDate: new Date("2027-11-03"),
          sgdAmount: "10.00",
          status: "cancelled",
        },
      });

      await assert.rejects(() => declineBookingWithRefund(booking.id), BookingNotDeclinableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 0);

      const bookingRow = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(bookingRow!.status, "cancelled");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("declining a booking twice rejects the second call cleanly, with no second refund", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "10.00" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-11-04",
        endDate: "2027-11-04",
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      await declineBookingWithRefund(booking.id);
      await assert.rejects(() => declineBookingWithRefund(booking.id), BookingNotDeclinableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 2); // the create-time debit + exactly one refund

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "10");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// Dates below are offsets from "now" (not fixed calendar dates) so the tiers
// stay correct regardless of when the suite runs, picked well clear of the
// 7-day/3-day boundaries to avoid flakiness from time-of-day.
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 2026-07-21 correction, confirmed with the product owner: the day-based
// tier no longer sizes the USER's refund on a supplier-initiated decline —
// they didn't cause it, so they're always made whole. It now sizes the
// SUPPLIER's penalty against SpaceSnap's commission portion instead, which
// resolves into a real SupplierPayable row. See lib/booking-payments.ts and
// declineBookingWithRefund's header comment for the full design.
describe("declineBookingWithRefund — supplier penalty against commission (2026-07-21 correction)", () => {
  test("declining >=7 days before start refunds the user 100% and writes a zero-penalty SupplierPayable", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(10),
        endDate: daysFromNow(10),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      const updated = await declineBookingWithRefund(booking.id, "Change of plans");
      assert.equal(updated.status, "cancelled");
      assert.equal(updated.cancelledBy, "supplier");
      assert.equal(updated.cancellationReason, "Change of plans");
      assert.ok(updated.cancelledAt);
      assert.equal(updated.userRefundPercent!.toString(), "100");
      assert.equal(updated.supplierPenaltyPercent!.toString(), "0");

      const refund = await prisma.transaction.findFirst({ where: { bookingId: booking.id, type: TransactionType.refund } });
      assert.ok(refund);
      assert.equal(refund!.amount.toString(), "10");
      assert.ok(refund!.stripePaymentIntentId);

      const payable = await prisma.supplierPayable.findUnique({ where: { bookingId: booking.id } });
      assert.ok(payable);
      assert.equal(payable!.companyId, company.id);
      assert.equal(payable!.grossAmount.toString(), "9"); // 10 - 10% commission (1)
      assert.equal(payable!.penaltyDeduction.toString(), "0");
      assert.equal(payable!.netAmount.toString(), "9");
      assert.equal(payable!.invoicingCadence, "monthly"); // default supplierTier: free
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("declining 3-6 days before start still refunds the user 100%, but penalizes the supplier 50% of commission", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(5),
        endDate: daysFromNow(5),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      const updated = await declineBookingWithRefund(booking.id);
      assert.equal(updated.userRefundPercent!.toString(), "100");
      assert.equal(updated.supplierPenaltyPercent!.toString(), "50");

      const refund = await prisma.transaction.findFirst({ where: { bookingId: booking.id, type: TransactionType.refund } });
      assert.ok(refund);
      assert.equal(refund!.amount.toString(), "10"); // user made whole regardless of timing

      const payable = await prisma.supplierPayable.findUnique({ where: { bookingId: booking.id } });
      assert.ok(payable);
      assert.equal(payable!.grossAmount.toString(), "9");
      assert.equal(payable!.penaltyDeduction.toString(), "0.5"); // 50% of the 1.00 commission
      assert.equal(payable!.netAmount.toString(), "8.5");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("declining <3 days before start still refunds the user 100%, and penalizes the supplier the full commission", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(1),
        endDate: daysFromNow(1),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      const updated = await declineBookingWithRefund(booking.id);
      assert.equal(updated.status, "cancelled");
      assert.equal(updated.userRefundPercent!.toString(), "100");
      assert.equal(updated.supplierPenaltyPercent!.toString(), "100");

      const refund = await prisma.transaction.findFirst({ where: { bookingId: booking.id, type: TransactionType.refund } });
      assert.ok(refund);
      assert.equal(refund!.amount.toString(), "10");

      const payable = await prisma.supplierPayable.findUnique({ where: { bookingId: booking.id } });
      assert.ok(payable);
      assert.equal(payable!.penaltyDeduction.toString(), "1"); // 100% of the 1.00 commission
      assert.equal(payable!.netAmount.toString(), "8"); // 9 gross - 1 penalty
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("earned-credit discount is reversed in full on decline, regardless of cancellation timing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.booking_discount_pct, value: "20", grantedVia: "test-fixture" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(1), // worst tier for the supplier's penalty — irrelevant to the user's refund now
        endDate: daysFromNow(1),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
        rewardGrantId: grant.id,
      });
      // 20% off 10.00 = 2.00 discount; Stripe charged for 8.00.
      assert.equal(booking.earnedCreditsApplied.toString(), "2");

      await declineBookingWithRefund(booking.id);

      const refund = await prisma.transaction.findFirst({ where: { bookingId: booking.id, type: TransactionType.refund } });
      assert.ok(refund);
      assert.equal(refund!.amount.toString(), "8"); // full amount actually charged to Stripe

      const earnedReversal = await prisma.transaction.findFirst({
        where: { bookingId: booking.id, type: TransactionType.earned_grant },
      });
      assert.ok(earnedReversal);
      assert.equal(earnedReversal!.amount.toString(), "2"); // full discount reversed
      assert.equal(earnedReversal!.rewardGrantId?.toString(), grant.id.toString());

      // The grant itself stays `redeemed` — only the ledger reverses.
      const grantAfter = await prisma.rewardGrant.findUnique({ where: { id: grant.id } });
      assert.equal(grantAfter!.status, "redeemed");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// User-initiated cancellation — the mirror image of the decline correction
// above. Here the day-based tier genuinely sizes the USER's own refund
// (they caused this), and the supplier is always made whole (they didn't).
describe("cancelBookingWithRefund — user-initiated, day-tier applies to the user's own refund", () => {
  test("cancelling >=7 days before start refunds the user 100%, supplier paid in full with zero penalty", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(10),
        endDate: daysFromNow(10),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      const updated = await cancelBookingWithRefund(booking.id, "Change of plans");
      assert.equal(updated.status, "cancelled");
      assert.equal(updated.cancelledBy, "user");
      assert.equal(updated.cancellationReason, "Change of plans");
      assert.equal(updated.userRefundPercent!.toString(), "100");
      assert.equal(updated.supplierPenaltyPercent!.toString(), "0");

      const refund = await prisma.transaction.findFirst({ where: { bookingId: booking.id, type: TransactionType.refund } });
      assert.ok(refund);
      assert.equal(refund!.amount.toString(), "10");

      const payable = await prisma.supplierPayable.findUnique({ where: { bookingId: booking.id } });
      assert.ok(payable);
      assert.equal(payable!.grossAmount.toString(), "9");
      assert.equal(payable!.penaltyDeduction.toString(), "0");
      assert.equal(payable!.netAmount.toString(), "9");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cancelling 3-6 days before start refunds the user exactly 50%, supplier still paid in full", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(5),
        endDate: daysFromNow(5),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      const updated = await cancelBookingWithRefund(booking.id);
      assert.equal(updated.userRefundPercent!.toString(), "50");
      assert.equal(updated.supplierPenaltyPercent!.toString(), "0");

      const refund = await prisma.transaction.findFirst({ where: { bookingId: booking.id, type: TransactionType.refund } });
      assert.ok(refund);
      assert.equal(refund!.amount.toString(), "5");

      const payable = await prisma.supplierPayable.findUnique({ where: { bookingId: booking.id } });
      assert.ok(payable);
      assert.equal(payable!.penaltyDeduction.toString(), "0");
      assert.equal(payable!.netAmount.toString(), "9"); // unaffected by the user's own refund tier
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cancelling <3 days before start refunds the user 0% and writes no refund Transaction, supplier still paid in full", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(1),
        endDate: daysFromNow(1),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      const updated = await cancelBookingWithRefund(booking.id);
      assert.equal(updated.status, "cancelled");
      assert.equal(updated.userRefundPercent!.toString(), "0");
      assert.equal(updated.supplierPenaltyPercent!.toString(), "0");

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 1); // only the create-time debit — no refund row at all
      assert.equal(transactions[0].type, TransactionType.booking_payment);

      const payable = await prisma.supplierPayable.findUnique({ where: { bookingId: booking.id } });
      assert.ok(payable);
      assert.equal(payable!.netAmount.toString(), "9");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("reverses an earned-credit discount proportionally to the user's own refund tier, supplier unaffected", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.booking_discount_pct, value: "20", grantedVia: "test-fixture" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(5), // 50% tier
        endDate: daysFromNow(5),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
        rewardGrantId: grant.id,
      });
      // 20% off 10.00 = 2.00 discount; Stripe charged for 8.00.
      assert.equal(booking.earnedCreditsApplied.toString(), "2");

      await cancelBookingWithRefund(booking.id);

      const refund = await prisma.transaction.findFirst({ where: { bookingId: booking.id, type: TransactionType.refund } });
      assert.ok(refund);
      assert.equal(refund!.amount.toString(), "4"); // 50% of the 8.00 actually charged to Stripe

      const earnedReversal = await prisma.transaction.findFirst({
        where: { bookingId: booking.id, type: TransactionType.earned_grant },
      });
      assert.ok(earnedReversal);
      assert.equal(earnedReversal!.amount.toString(), "1"); // 50% of the 2.00 discount
      assert.equal(earnedReversal!.rewardGrantId?.toString(), grant.id.toString());

      const grantAfter = await prisma.rewardGrant.findUnique({ where: { id: grant.id } });
      assert.equal(grantAfter!.status, "redeemed");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cancelling an already-cancelled booking rejects cleanly and does not touch the ledger", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date(daysFromNow(10)),
          endDate: new Date(daysFromNow(10)),
          sgdAmount: "10.00",
          status: "cancelled",
        },
      });

      await assert.rejects(() => cancelBookingWithRefund(booking.id), BookingNotCancellableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 0);

      const payable = await prisma.supplierPayable.findUnique({ where: { bookingId: booking.id } });
      assert.equal(payable, null);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cancelling a booking twice rejects the second call cleanly, with no second refund or SupplierPayable", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(10),
        endDate: daysFromNow(10),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      await cancelBookingWithRefund(booking.id);
      await assert.rejects(() => cancelBookingWithRefund(booking.id), BookingNotCancellableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 2); // the create-time debit + exactly one refund

      const payables = await prisma.supplierPayable.findMany({ where: { bookingId: booking.id } });
      assert.equal(payables.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
