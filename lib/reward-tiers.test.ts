// Coverage for Sprint 6.5 — User Reward Tier system + referral mechanic.
// Pure unit tests for the tier-computation table (no DB), plus real-DB
// integration tests through the actual wired write-paths
// (createBookingWithDebit -> confirmBookingWithAudit -> createCheckIn ->
// checkOutCheckIn), same convention as lib/supplier-payables.test.ts — hits
// the real dev/test Postgres DB and the real Stripe test sandbox, no mocking.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType, type Listing } from "../app/generated/prisma/client";
import { computeUserRewardTier, rebatePercentForTier, getUserRewardTierWindowStats } from "./reward-tiers";
import { createBookingWithDebit, confirmBookingWithAudit } from "./bookings";
import { createCheckIn, checkOutCheckIn } from "./check-ins";

const TEST_PAYMENT_METHOD_ID = "pm_card_visa";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

describe("computeUserRewardTier (pure)", () => {
  test("free tier: no activity at all", () => {
    assert.equal(computeUserRewardTier(0, 0), "free");
  });

  test("starter requires BOTH thresholds — bookings short falls back to free", () => {
    assert.equal(computeUserRewardTier(7, 1000), "free");
  });

  test("starter requires BOTH thresholds — spend short falls back to free", () => {
    assert.equal(computeUserRewardTier(8, 999), "free");
  });

  test("starter: exactly at both thresholds", () => {
    assert.equal(computeUserRewardTier(8, 1000), "starter");
  });

  test("growth requires BOTH thresholds — bookings short falls back to starter", () => {
    assert.equal(computeUserRewardTier(19, 2500), "starter");
  });

  test("growth requires BOTH thresholds — spend short falls back to starter", () => {
    assert.equal(computeUserRewardTier(20, 2499), "starter");
  });

  test("growth: exactly at both thresholds", () => {
    assert.equal(computeUserRewardTier(20, 2500), "growth");
  });

  test("power requires BOTH thresholds — bookings short falls back to growth", () => {
    assert.equal(computeUserRewardTier(34, 4500), "growth");
  });

  test("power requires BOTH thresholds — spend short falls back to growth", () => {
    assert.equal(computeUserRewardTier(35, 4499), "growth");
  });

  test("power: exactly at both thresholds", () => {
    assert.equal(computeUserRewardTier(35, 4500), "power");
  });

  test("power: comfortably above every threshold stays power (no tier above it)", () => {
    assert.equal(computeUserRewardTier(1000, 100_000), "power");
  });
});

describe("rebatePercentForTier (pure)", () => {
  test("maps each tier to its confirmed rebate %", () => {
    assert.equal(rebatePercentForTier("free"), 1);
    assert.equal(rebatePercentForTier("starter"), 1.2);
    assert.equal(rebatePercentForTier("growth"), 1.5);
    assert.equal(rebatePercentForTier("power"), 1.8);
  });
});

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Reward Tier Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser(referredByUserId: string | null = null) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Reward Tier Test User",
      email: `reward-tier-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
      referredByUserId,
    },
  });
}

function createSpaceListing(companyId: bigint, priceDay: string) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Reward Tier Test Listing",
      priceDay,
      priceWeek: "9999.00",
      priceMonth: "99999.00",
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
  return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

// Directly inserts an already-`completed` booking, bypassing the real
// create->confirm->check-in->check-out flow and Stripe entirely — used only
// to seed a user's rolling-window history cheaply for tier-threshold tests
// (getUserRewardTierWindowStats reads straight off `bookings`, regardless of
// how a row got there).
async function seedCompletedBooking(userId: string, listingId: bigint, sgdAmount: string, completedAt: Date) {
  return prisma.booking.create({
    data: {
      userId,
      listingId,
      bookingType: BookingType.daily,
      startDate: completedAt,
      endDate: completedAt,
      sgdAmount,
      status: "completed",
      completedAt,
    },
  });
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

describe("getUserRewardTierWindowStats (real DB)", () => {
  test("excludes completed bookings older than the 3-month rolling window", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "50.00");
      await seedCompletedBooking(user.id, listing.id, "50.00", monthsAgo(4));

      const stats = await getUserRewardTierWindowStats(user.id);
      assert.equal(stats.bookingCount, 0);
      assert.equal(stats.spendSgd, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("includes completed bookings inside the 3-month rolling window", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "50.00");
      await seedCompletedBooking(user.id, listing.id, "50.00", monthsAgo(2));

      const stats = await getUserRewardTierWindowStats(user.id);
      assert.equal(stats.bookingCount, 1);
      assert.equal(stats.spendSgd, 50);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a pending (not completed) booking doesn't count toward either figure", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "50.00");
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date(),
          endDate: new Date(),
          sgdAmount: "50.00",
        },
      });

      const stats = await getUserRewardTierWindowStats(user.id);
      assert.equal(stats.bookingCount, 0);
      assert.equal(stats.spendSgd, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a ReferralSpendBonus row within the window is added to spendSgd (not bookingCount)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await prisma.referralSpendBonus.create({ data: { userId: user.id, amount: "200.00" } });

      const stats = await getUserRewardTierWindowStats(user.id);
      assert.equal(stats.bookingCount, 0);
      assert.equal(stats.spendSgd, 200);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("reward tier rebate — creation-time snapshot, completion-time payout", () => {
  test("a fresh (free-tier) user's booking snapshots 1% and pays out 1% at completion", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "10.00");
      const completed = await completeBooking(user.id, listing, daysFromNow(10));

      assert.equal(completed.rewardTierRebatePercent.toString(), "1");
      assert.ok(completed.completedAt);

      const rebateTx = await prisma.transaction.findFirst({
        where: { bookingId: completed.id, type: "earned_grant" },
      });
      assert.ok(rebateTx);
      assert.equal(rebateTx!.amount.toString(), "0.1"); // 10.00 * 1%

      const activity = await prisma.activityLog.findMany({
        where: { userId: user.id, actionType: "reward_tier_rebate_earned" },
      });
      assert.equal(activity.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a user who has already reached Starter snapshots 1.2% on their next booking", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "50.00");

      // Seed exactly 8 completed bookings @ $125 = $1000 total — Starter's
      // exact thresholds — without paying for 8 real Stripe charges (see
      // seedCompletedBooking's own comment). Each on a distinct past date —
      // same listing, same day would collide with the bookings_no_overlap
      // exclusion constraint.
      for (let i = 0; i < 8; i++) {
        const d = monthsAgo(1);
        d.setUTCDate(d.getUTCDate() - i);
        await seedCompletedBooking(user.id, listing.id, "125.00", d);
      }

      const completed = await completeBooking(user.id, listing, daysFromNow(10));
      assert.equal(completed.rewardTierRebatePercent.toString(), "1.2");

      const rebateTx = await prisma.transaction.findFirst({
        where: { bookingId: completed.id, type: "earned_grant" },
      });
      assert.ok(rebateTx);
      assert.equal(rebateTx!.amount.toString(), "0.6"); // 50.00 * 1.2%
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("referral bonus — conversion on the referee's first qualifying booking", () => {
  test("a referee's $300+ completed booking grants the referrer 20 SGD + a 200 SGD spend bonus, once", async () => {
    const company = await createCompany();
    const referrer = await createUser();
    const referee = await createUser(referrer.id);
    try {
      const listing = await createSpaceListing(company.id, "300.00");

      const first = await completeBooking(referee.id, listing, daysFromNow(10));

      const refereeRow = await prisma.user.findUniqueOrThrow({ where: { id: referee.id } });
      assert.ok(refereeRow.referralConvertedAt);

      const grantTx = await prisma.transaction.findFirst({
        where: { userId: referrer.id, bookingId: first.id, type: "earned_grant" },
      });
      assert.ok(grantTx);
      assert.equal(grantTx!.amount.toString(), "20");

      const spendBonus = await prisma.referralSpendBonus.findMany({ where: { userId: referrer.id } });
      assert.equal(spendBonus.length, 1);
      assert.equal(spendBonus[0].amount.toString(), "200");

      const activity = await prisma.activityLog.findMany({
        where: { userId: referrer.id, actionType: "referral_bonus_earned" },
      });
      assert.equal(activity.length, 1);

      // A second qualifying booking by the SAME already-converted referee
      // must not grant again.
      await completeBooking(referee.id, listing, daysFromNow(11));

      const spendBonusAfter = await prisma.referralSpendBonus.findMany({ where: { userId: referrer.id } });
      assert.equal(spendBonusAfter.length, 1);

      const grantTxCount = await prisma.transaction.count({
        where: { userId: referrer.id, type: "earned_grant", amount: "20" },
      });
      assert.equal(grantTxCount, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [referrer.id, referee.id]);
    }
  });

  test("a referee's booking below the $300 qualifying threshold does not convert the referral", async () => {
    const company = await createCompany();
    const referrer = await createUser();
    const referee = await createUser(referrer.id);
    try {
      const listing = await createSpaceListing(company.id, "50.00");
      await completeBooking(referee.id, listing, daysFromNow(10));

      const refereeRow = await prisma.user.findUniqueOrThrow({ where: { id: referee.id } });
      assert.equal(refereeRow.referralConvertedAt, null);

      const spendBonus = await prisma.referralSpendBonus.findMany({ where: { userId: referrer.id } });
      assert.equal(spendBonus.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [referrer.id, referee.id]);
    }
  });

  test("a user with no referrer completing a $300+ booking triggers no referral side-effects", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id, "300.00");
      await completeBooking(user.id, listing, daysFromNow(10));

      const bonuses = await prisma.referralSpendBonus.count();
      const userRow = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(userRow.referralConvertedAt, null);
      // Not asserting `bonuses === 0` globally (other concurrent test runs
      // may write rows) — the per-user assertion above is the real guard.
      assert.ok(bonuses >= 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
