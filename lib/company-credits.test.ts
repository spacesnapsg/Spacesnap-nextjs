// Coverage for the per-COMPANY credit ledger (2026-07-22 fulfillment
// session, confirmed with the product owner) — mirrors lib/reward-tiers.ts's
// user-rebate coverage but scoped to Company via lib/company-credits.ts.
// Hits the real dev/test Postgres DB through Prisma, same convention as
// lib/supplier-payables.test.ts / lib/reward-tiers.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType, type Listing } from "../app/generated/prisma/client";
import { createBookingWithDebit, confirmBookingWithAudit } from "./bookings";
import { createCheckIn, checkOutCheckIn } from "./check-ins";
import {
  getCompanyPurchasedBalance,
  getCompanyEarnedBalance,
  createCompanyTopUp,
  parseCompanyTopUpAmount,
  purchaseBumps,
  BUMP_UNIT_COST_CREDITS,
  InsufficientCompanyPurchasedBalanceError,
} from "./company-credits";
import { activateBump, ListingNotFoundError, NoBumpsAvailableError, purchaseAndApplyPin, ListingNotAvailableError, PIN_DURATION_COST_CREDITS } from "./listings";
import { ApiValidationError } from "./api-errors";

const TEST_PAYMENT_METHOD_ID = "pm_card_visa";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Company Credits Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Company Credits Test User",
      email: `company-credits-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint, priceDay: string) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Company Credits Test Listing",
      priceDay,
      priceWeek: "9999.00",
      priceMonth: "99999.00",
    },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } }); // cascades company_transactions
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
  return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

describe("parseCompanyTopUpAmount (pure)", () => {
  test("rejects a missing/non-numeric amount", () => {
    assert.throws(() => parseCompanyTopUpAmount({}), ApiValidationError);
    assert.throws(() => parseCompanyTopUpAmount({ amount: "50" }), ApiValidationError);
  });

  test("rejects a zero or negative amount", () => {
    assert.throws(() => parseCompanyTopUpAmount({ amount: 0 }), ApiValidationError);
    assert.throws(() => parseCompanyTopUpAmount({ amount: -10 }), ApiValidationError);
  });

  test("accepts a positive amount, converted from credits to true SGD", () => {
    const amount = parseCompanyTopUpAmount({ amount: 500 }); // 500 credits = S$50.00
    assert.equal(amount.toString(), "50");
  });
});

describe("getCompanyPurchasedBalance / getCompanyEarnedBalance (real DB)", () => {
  test("both start at zero for a fresh company", async () => {
    const company = await createCompany();
    try {
      assert.equal((await getCompanyPurchasedBalance(company.id)).toString(), "0");
      assert.equal((await getCompanyEarnedBalance(company.id)).toString(), "0");
    } finally {
      await cleanupCompanyAndUsers(company.id, []);
    }
  });
});

describe("createCompanyTopUp", () => {
  test("increases purchasedBalance, leaves earnedBalance untouched, any member can call it", async () => {
    const company = await createCompany();
    const member = await createUser();
    try {
      const first = await createCompanyTopUp(company.id, member.id, parseCompanyTopUpAmount({ amount: 1000 }));
      assert.equal(first.balance.toString(), "100"); // 1000 credits = S$100.00
      assert.equal(first.transaction.userId, member.id);
      assert.equal(first.transaction.type, "purchased_topup");

      const second = await createCompanyTopUp(company.id, member.id, parseCompanyTopUpAmount({ amount: 500 }));
      assert.equal(second.balance.toString(), "150"); // adds, doesn't overwrite

      assert.equal((await getCompanyEarnedBalance(company.id)).toString(), "0");
    } finally {
      await cleanupCompanyAndUsers(company.id, [member.id]);
    }
  });
});

describe("company booking-completion rebate (real DB, real Stripe test sandbox)", () => {
  test("a fresh (free-tier) company's completed booking earns a 1% rebate, tied to that booking", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      const completed = await completeBooking(user.id, listing, daysFromNow(10));

      const balance = await getCompanyEarnedBalance(company.id);
      assert.equal(balance.toString(), "0.2"); // 20.00 * 1%

      const rows = await prisma.companyTransaction.findMany({ where: { companyId: company.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].type, "earned_rebate");
      assert.equal(rows[0].bookingId, completed.id);
      assert.equal(rows[0].userId, null); // not any one member's action
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a pending (not yet completed) booking earns the company nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: daysFromNow(10),
        endDate: daysFromNow(10),
        cost: listing.priceDay!,
        paymentMethodId: TEST_PAYMENT_METHOD_ID,
      });

      assert.equal((await getCompanyEarnedBalance(company.id)).toString(), "0");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("purchaseBumps (Sprint 6.12)", () => {
  test("buying N bumps debits purchasedBalance and increments bumpsAvailable", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      await createCompanyTopUp(company.id, admin.id, parseCompanyTopUpAmount({ amount: 10_000 })); // S$1000

      const { bumpsAvailable } = await purchaseBumps(company.id, 3, admin.id);
      assert.equal(bumpsAvailable, 3);

      const balance = await getCompanyPurchasedBalance(company.id);
      // 1000 - (3 * 50 credits / 10 credits-per-sgd) = 1000 - 15 = 985
      assert.equal(balance.toString(), "985");

      const rows = await prisma.companyTransaction.findMany({ where: { companyId: company.id, type: "purchased_spend" } });
      assert.equal(rows.length, 1);
      assert.equal(Number(rows[0].amount), -((3 * BUMP_UNIT_COST_CREDITS) / 10));
      assert.equal(rows[0].userId, admin.id);
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });

  test("buying more bumps than the purchased balance covers is rejected, no partial debit", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      // No top-up — purchasedBalance is 0.
      await assert.rejects(() => purchaseBumps(company.id, 1, admin.id), InsufficientCompanyPurchasedBalanceError);

      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), "0");
      const fresh = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
      assert.equal(fresh.bumpsAvailable, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });
});

describe("activateBump (Sprint 6.12)", () => {
  test("spending a bump resets the listing's boostedAt to now and decrements the counter", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      const originalBoostedAt = listing.boostedAt;

      await createCompanyTopUp(company.id, admin.id, parseCompanyTopUpAmount({ amount: 10_000 }));
      await purchaseBumps(company.id, 1, admin.id);

      await new Promise((resolve) => setTimeout(resolve, 5));
      const bumped = await activateBump(listing.id, company.id);
      assert.ok(bumped.boostedAt.getTime() > originalBoostedAt.getTime());

      const fresh = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
      assert.equal(fresh.bumpsAvailable, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });

  test("activating a bump with zero available is rejected", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      await assert.rejects(() => activateBump(listing.id, company.id), NoBumpsAvailableError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });

  test("a listing belonging to a different company is rejected as not found", async () => {
    const companyA = await createCompany();
    const companyB = await createCompany();
    const admin = await createUser();
    try {
      const listing = await createSpaceListing(companyA.id, "20.00");
      await assert.rejects(() => activateBump(listing.id, companyB.id), ListingNotFoundError);
    } finally {
      await cleanupCompanyAndUsers(companyA.id, []);
      await cleanupCompanyAndUsers(companyB.id, [admin.id]);
    }
  });
});

describe("purchaseAndApplyPin (Sprint 6.12)", () => {
  test("a 7-day pin sets pinnedAt/pinnedUntil ~7 days out and debits purchasedBalance", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      await createCompanyTopUp(company.id, admin.id, parseCompanyTopUpAmount({ amount: 10_000 }));

      const before = Date.now();
      const pinned = await purchaseAndApplyPin(company.id, listing.id, 7, admin.id);
      assert.ok(pinned.pinnedAt !== null && pinned.pinnedUntil !== null);
      const days = (pinned.pinnedUntil!.getTime() - before) / (24 * 60 * 60 * 1000);
      assert.ok(days > 6.9 && days < 7.1, `expected ~7 days, got ${days}`);

      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), (1000 - PIN_DURATION_COST_CREDITS[7] / 10).toString());
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });

  test("re-pinning an already-pinned listing extends the window rather than erroring", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      await createCompanyTopUp(company.id, admin.id, parseCompanyTopUpAmount({ amount: 10_000 }));

      const first = await purchaseAndApplyPin(company.id, listing.id, 7, admin.id);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await purchaseAndApplyPin(company.id, listing.id, 30, admin.id);

      assert.ok(second.pinnedAt!.getTime() > first.pinnedAt!.getTime());
      assert.ok(second.pinnedUntil!.getTime() > first.pinnedUntil!.getTime());
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });

  test("an unavailable listing cannot be pinned", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      await prisma.listing.update({ where: { id: listing.id }, data: { isAvailable: false } });
      await createCompanyTopUp(company.id, admin.id, parseCompanyTopUpAmount({ amount: 10_000 }));

      await assert.rejects(() => purchaseAndApplyPin(company.id, listing.id, 7, admin.id), ListingNotAvailableError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });

  test("insufficient purchasedBalance is rejected, listing stays unpinned", async () => {
    const company = await createCompany();
    const admin = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "20.00");
      // No top-up — purchasedBalance is 0.
      await assert.rejects(() => purchaseAndApplyPin(company.id, listing.id, 7, admin.id), InsufficientCompanyPurchasedBalanceError);

      const fresh = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      assert.equal(fresh.pinnedAt, null);
      assert.equal(fresh.pinnedUntil, null);
    } finally {
      await cleanupCompanyAndUsers(company.id, [admin.id]);
    }
  });
});
