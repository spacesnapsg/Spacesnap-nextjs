// Coverage for the live-computed supplier payable balance (2026-07-21,
// product-owner-clarified correction) — a supplier-cancellation penalty on
// one booking must net against earnings from other, unrelated bookings via
// a live SUM, not a per-row "deduct from balance" write. Hits the real dev
// Postgres DB through Prisma (no mocking), same convention as
// lib/bookings.test.ts / lib/check-ins.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType, TransactionType, PayoutCadence, Prisma, type Listing } from "../app/generated/prisma/client";
import { createBookingWithDebit, confirmBookingWithAudit, declineBookingPendingResolution } from "./bookings";
import { createCheckIn, checkOutCheckIn } from "./check-ins";
import { getSupplierPendingPayableBalance } from "./supplier-payables";
import { createPurchaseWithDebit } from "./purchases";

const TEST_PAYMENT_METHOD_ID = "pm_card_visa";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Payable Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Payable Test User",
      email: `payable-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint, priceDay: string) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Payable Test Listing",
      priceDay,
      priceWeek: "60.00",
      priceMonth: "200.00",
    },
  });
}

function createConsumableListing(companyId: bigint, pricePerUnit: string) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.consumables,
      name: "Payable Test Consumable",
      pricePerUnit,
      stockQuantity: 1000,
      packSize: "10",
    },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function completeBooking(userId: string, listing: Listing, startDate: string) {
  const booking = await createBookingWithDebit({
    userId,
    listingId: listing.id,
    bookingType: BookingType.daily,
    startDate,
    endDate: startDate,
    cost: listing.priceDay!,
    paymentMethodId: TEST_PAYMENT_METHOD_ID,
  });
  await confirmBookingWithAudit(booking.id);
  const checkIn = await createCheckIn({ userId, listingId: listing.id, bookingId: booking.id });
  await checkOutCheckIn(checkIn.id);
  return booking;
}

describe("createCompletedBookingPayable — markup/commission split (F2)", () => {
  // The product owner's worked example, end to end through the real payable
  // path: supplier base 100, member charged 150 (50% markup), 10% commission.
  // Supplier is paid 90% of BASE (90); SpaceSnap keeps the markup + 10% of
  // base (60 = 150 - 90).
  test("base 100 @ 50% markup / 10% commission → supplier 90, SpaceSnap 60", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "100.00");
      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(10),
        endDate: daysFromNow(10),
        cost: new Prisma.Decimal("150.00"), // marked-up marketplace price
        baseAmount: new Prisma.Decimal("100.00"), // supplier's base
        commissionPercent: new Prisma.Decimal("10"),
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });
      await confirmBookingWithAudit(booking.id);
      const checkIn = await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: booking.id });
      await checkOutCheckIn(checkIn.id);

      const payable = await prisma.supplierPayable.findUniqueOrThrow({ where: { bookingId: booking.id } });
      assert.equal(payable.grossAmount.toString(), "90");
      assert.equal(payable.commissionAmount.toString(), "60");
      assert.equal(payable.netAmount.toString(), "90");
      // Reconciliation identity: member paid (150) = SpaceSnap (60) + supplier (90).
      assert.equal(payable.commissionAmount.add(payable.netAmount).toString(), booking.sgdAmount.toString());
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("createConsumablePayable — consumables 7% payout (F2 Part C)", () => {
  // A Buy Now sale end to end: member pays RSP 100 (no markup on consumables);
  // supplier is owed 93, SpaceSnap keeps 7. Proves the wiring in
  // createPurchaseWithDebit, not just the helper.
  test("Buy Now RSP 100 @ 7% → supplier 93 / SpaceSnap 7, flows into pending balance", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumableListing(company.id, "100.00");
      // Fund the buyer's purchasedBalance (Buy Now debits it, no Stripe).
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00", description: "test topup" },
      });

      const purchase = await createPurchaseWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: new Prisma.Decimal("100.00"),
        unitPrice: new Prisma.Decimal("100.00"),
      });

      const payable = await prisma.supplierPayable.findUniqueOrThrow({ where: { purchaseId: purchase.id } });
      assert.equal(payable.grossAmount.toString(), "93");
      assert.equal(payable.commissionAmount.toString(), "7");
      assert.equal(payable.netAmount.toString(), "93");
      assert.equal(payable.bookingId, null);
      assert.equal(payable.bulkOrderRequestId, null);

      const balance = await getSupplierPendingPayableBalance(company.id);
      assert.equal(balance.toString(), "93");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  // The generalized table must still hold exactly one source per row.
  test("the exactly-one-source CHECK rejects a payable with no source", async () => {
    const company = await createCompany();
    try {
      await assert.rejects(() =>
        prisma.supplierPayable.create({
          data: {
            companyId: company.id,
            grossAmount: new Prisma.Decimal("1"),
            commissionAmount: new Prisma.Decimal("0"),
            netAmount: new Prisma.Decimal("1"),
            payoutCadence: PayoutCadence.biweekly,
          },
        })
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, []);
    }
  });
});

describe("getSupplierPendingPayableBalance", () => {
  test("returns zero for a company with no SupplierPayable rows at all", async () => {
    const company = await createCompany();
    try {
      const balance = await getSupplierPendingPayableBalance(company.id);
      assert.equal(balance.toString(), "0");
    } finally {
      await cleanupCompanyAndUsers(company.id, []);
    }
  });

  test("only sums rows with status 'pending' — scheduled/paid rows are excluded", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "5.00");
      const booking = await completeBooking(user.id, listing, daysFromNow(10));

      // Manually move the row to 'scheduled' (no write-path builds this yet —
      // see the still-open Sprint 6 Invoice/Receipt gap) to prove the query
      // filters on status rather than summing every row for the company.
      await prisma.supplierPayable.update({ where: { bookingId: booking.id }, data: { status: "scheduled" } });

      const balance = await getSupplierPendingPayableBalance(company.id);
      assert.equal(balance.toString(), "0");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  // The product owner's own worked example: 3 bookings at $5 each (one
  // supplier). Two complete normally; the third is declined by the supplier
  // less than 3 days out (100% cancellation-window penalty tier). Expected:
  // supplier ends up owed $8.50, SpaceSnap keeps $1.50 of the original $15 —
  // $1 commission from the two completed bookings, $0.50 penalty from the
  // declined one — with the $5 for the declined booking refunded to the user
  // in full and never touching the supplier's balance either way.
  test("worked example: 2 completed bookings + 1 supplier-declined booking nets to $8.50 owed", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "5.00");

      await completeBooking(user.id, listing, daysFromNow(10));
      await completeBooking(user.id, listing, daysFromNow(11));

      const declinedBooking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(1), // < 3 days out — 100% penalty tier
        endDate: daysFromNow(1),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });
      const declined = await declineBookingPendingResolution(declinedBooking.id);
      assert.equal(declined.supplierPenaltyPercent!.toString(), "100");

      const payables = await prisma.supplierPayable.findMany({ where: { companyId: company.id } });
      assert.equal(payables.length, 3);

      const completedPayables = payables.filter((p) => p.grossAmount.gt(0));
      assert.equal(completedPayables.length, 2);
      for (const p of completedPayables) {
        assert.equal(p.grossAmount.toString(), "4.5"); // 5.00 - 10% commission (0.50)
        assert.equal(p.penaltyDeduction.toString(), "0");
        assert.equal(p.netAmount.toString(), "4.5");
      }

      const declinedPayable = payables.find((p) => p.bookingId === declinedBooking.id)!;
      assert.equal(declinedPayable.grossAmount.toString(), "0");
      assert.equal(declinedPayable.penaltyDeduction.toString(), "0.5"); // 100% of the 0.50 commission
      assert.equal(declinedPayable.netAmount.toString(), "-0.5");

      const balance = await getSupplierPendingPayableBalance(company.id);
      assert.equal(balance.toString(), "8.5"); // 4.5 + 4.5 - 0.5
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  // Mirrors the worked example above but with a low-balance supplier
  // (only one small completed booking) whose pending balance can't cover a
  // later penalty — confirms the SUM is allowed to go negative rather than
  // being clamped at zero, representing an amount to invoice the supplier
  // for directly (no automated collection is built, per the still-open
  // Sprint 6 Invoice/Receipt gap — this only proves the number itself is
  // correct).
  test("penalty exceeding the pending balance drives it negative, not clamped at zero", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "5.00");

      const decliningBooking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(1), // 100% penalty tier
        endDate: daysFromNow(1),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });
      await declineBookingPendingResolution(decliningBooking.id);

      // No completed bookings at all this time — the penalty is the only
      // ledger event for this company.
      const balance = await getSupplierPendingPayableBalance(company.id);
      assert.equal(balance.toString(), "-0.5");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
