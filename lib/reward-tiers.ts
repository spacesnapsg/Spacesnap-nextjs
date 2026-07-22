import { Prisma, ActivityActionType, TransactionType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Sprint 6.5 — User Reward Tier system (Free/Starter/Growth/Power). Confirmed
// with the product owner (2026-07-21): rolling 3-month window, BOTH a
// bookings-count AND a spend threshold must be met (highest tier whose both
// conditions are satisfied wins). Distinct from two other "tier" concepts
// already in this codebase — the scrapped equipment-certification tier
// (earning_method, see the Sprint 4 "tier comparison scrapped" note) and
// Company.supplierTier (supplier payment tier) — this is the third, separate
// *user reward* tier, never stored denormalized (same "live SUM, never a
// cached column" principle as getCreditBalance/getSupplierPendingPayableBalance).
//
// Flagged assumptions (inferred from the brief, not explicitly specified —
// per this repo's "flag rather than silently guess" convention):
//   - Both bookings-count and spend are counted from COMPLETED bookings only
//     (matches every other money-flow feature's use of "completed" as the
//     event that counts, e.g. createCompletedBookingPayable).
//   - Dollar figures given by the product owner are true SGD, converted to
//     credits only at API edges (sgdToCredits/creditsToSgd, lib/credit-units.ts)
//     — never inside this business logic, same discipline as every other
//     money-flow module in this codebase.
export type UserRewardTier = "free" | "starter" | "growth" | "power";

interface RewardTierDefinition {
  tier: UserRewardTier;
  minBookings: number;
  minSpendSgd: number;
  rebatePercent: number;
}

// Highest tier first — computeUserRewardTier below evaluates in this order
// and returns the first (i.e. highest) tier whose BOTH thresholds are met.
const REWARD_TIERS: RewardTierDefinition[] = [
  { tier: "power", minBookings: 35, minSpendSgd: 4500, rebatePercent: 1.8 },
  { tier: "growth", minBookings: 20, minSpendSgd: 2500, rebatePercent: 1.5 },
  { tier: "starter", minBookings: 8, minSpendSgd: 1000, rebatePercent: 1.2 },
  { tier: "free", minBookings: 0, minSpendSgd: 0, rebatePercent: 1 },
];

const REWARD_TIER_ORDER: UserRewardTier[] = ["free", "starter", "growth", "power"];

export const REWARD_TIER_WINDOW_MONTHS = 3;

// Referral mechanic constants, all true SGD (see the module comment above).
export const REFERRAL_QUALIFYING_BOOKING_SGD = 300;
export const REFERRAL_BONUS_SGD = 20;
export const REFERRAL_SPEND_BONUS_SGD = 200;

export function computeUserRewardTier(bookingCount: number, spendSgd: number): UserRewardTier {
  for (const def of REWARD_TIERS) {
    if (bookingCount >= def.minBookings && spendSgd >= def.minSpendSgd) {
      return def.tier;
    }
  }
  return "free";
}

export function rebatePercentForTier(tier: UserRewardTier): number {
  return REWARD_TIERS.find((def) => def.tier === tier)!.rebatePercent;
}

function nextTier(tier: UserRewardTier): UserRewardTier | null {
  const index = REWARD_TIER_ORDER.indexOf(tier);
  return index < REWARD_TIER_ORDER.length - 1 ? REWARD_TIER_ORDER[index + 1] : null;
}

function windowStart(asOf: Date): Date {
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() - REWARD_TIER_WINDOW_MONTHS);
  return d;
}

export interface RewardTierWindowStats {
  bookingCount: number;
  spendSgd: number;
}

// Live-computed, never stored denormalized — same principle as
// getCreditBalance (lib/credits.ts). Sums COMPLETED bookings' sgdAmount
// (headline booking value, not the post-discount Stripe charge) plus any
// ReferralSpendBonus rows, both within the rolling window.
export async function getUserRewardTierWindowStats(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  asOf: Date = new Date()
): Promise<RewardTierWindowStats> {
  const start = windowStart(asOf);

  const [bookingAgg, spendBonusAgg] = await Promise.all([
    client.booking.aggregate({
      where: { userId, status: "completed", completedAt: { gte: start } },
      _count: { _all: true },
      _sum: { sgdAmount: true },
    }),
    client.referralSpendBonus.aggregate({
      where: { userId, createdAt: { gte: start } },
      _sum: { amount: true },
    }),
  ]);

  const bookingSpend = bookingAgg._sum.sgdAmount ?? new Prisma.Decimal(0);
  const bonusSpend = spendBonusAgg._sum.amount ?? new Prisma.Decimal(0);

  return {
    bookingCount: bookingAgg._count._all,
    spendSgd: Number(bookingSpend.add(bonusSpend)),
  };
}

export interface UserRewardTierStatus {
  tier: UserRewardTier;
  rebatePercent: number;
  bookingCount: number;
  spendSgd: number;
  nextTier: UserRewardTier | null;
  bookingsToNextTier: number | null;
  spendSgdToNextTier: number | null;
  // 0-100 progress bar toward nextTier. Both bookings AND spend thresholds
  // must be met (see the module comment's tier table), so progress is
  // bottlenecked by whichever criterion is furthest behind — the UI's
  // progress bar reflects that, not a naive average of the two. 100 for the
  // top tier (Power), which has no nextTier to progress toward.
  progressPercent: number;
}

// Surfaces only the delta to the next tier (same "gaps only, not a full
// re-explanation of what's already met" idiom the scrapped lib/tiers.ts
// design got right, even though its comparison model itself was wrong).
export async function getUserRewardTier(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  asOf: Date = new Date()
): Promise<UserRewardTierStatus> {
  const stats = await getUserRewardTierWindowStats(userId, client, asOf);
  const tier = computeUserRewardTier(stats.bookingCount, stats.spendSgd);
  const next = nextTier(tier);
  const nextDef = next ? REWARD_TIERS.find((def) => def.tier === next)! : null;

  const progressPercent = nextDef
    ? Math.round(
        Math.min(
          Math.min(1, stats.bookingCount / nextDef.minBookings),
          Math.min(1, stats.spendSgd / nextDef.minSpendSgd)
        ) * 100
      )
    : 100;

  return {
    tier,
    rebatePercent: rebatePercentForTier(tier),
    bookingCount: stats.bookingCount,
    spendSgd: stats.spendSgd,
    nextTier: next,
    bookingsToNextTier: nextDef ? Math.max(0, nextDef.minBookings - stats.bookingCount) : null,
    spendSgdToNextTier: nextDef ? Math.max(0, nextDef.minSpendSgd - stats.spendSgd) : null,
    progressPercent,
  };
}

// Written once a booking actually completes (checkOutCheckIn, lib/check-ins.ts),
// mirroring createCompletedBookingPayable's (lib/supplier-payables.ts) exact
// pattern. Pays out the rebate % SNAPSHOTTED AT CREATION (Booking.rewardTierRebatePercent)
// — not the user's current tier — as an earned_grant Transaction. Reuses the
// existing earned_grant TransactionType value (its own schema comment already
// lists "booking activity" as a covered case) rather than adding a new one.
export async function grantRewardTierRebate(tx: Prisma.TransactionClient, bookingId: bigint): Promise<void> {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const rebateAmount = booking.sgdAmount.mul(booking.rewardTierRebatePercent).div(100).toDecimalPlaces(2);

  if (rebateAmount.lte(0)) return;

  await tx.transaction.create({
    data: {
      userId: booking.userId,
      bookingId: booking.id,
      type: TransactionType.earned_grant,
      amount: rebateAmount,
      description: `Booking #${booking.id} — ${booking.rewardTierRebatePercent}% reward tier rebate (${rebateAmount} SGD earned credits).`,
    },
  });

  await tx.activityLog.create({
    data: {
      userId: booking.userId,
      actionType: ActivityActionType.reward_tier_rebate_earned,
      description: `Earned a ${booking.rewardTierRebatePercent}% reward tier rebate (${rebateAmount} SGD) on booking #${booking.id}.`,
      relatedListingId: booking.listingId,
    },
  });
}

// Checked at the same booking-completion point as grantRewardTierRebate
// above. A referral converts (pays out) AT MOST ONCE — User.referralConvertedAt
// is the guard, set here the first time the referee's own booking clears the
// qualifying threshold. This session's own inferred assumption: repeat
// qualifying bookings by the same already-converted referee are a no-op, not
// a repeat payout (flagged per this repo's "flag rather than silently guess"
// convention — not explicitly specified by the product owner).
export async function maybeConvertReferral(
  tx: Prisma.TransactionClient,
  refereeUserId: string,
  qualifyingBookingId: bigint,
  bookingSgdAmount: Prisma.Decimal
): Promise<void> {
  if (bookingSgdAmount.lt(REFERRAL_QUALIFYING_BOOKING_SGD)) return;

  const referee = await tx.user.findUniqueOrThrow({ where: { id: refereeUserId } });
  if (!referee.referredByUserId || referee.referralConvertedAt !== null) return;

  const referrerId = referee.referredByUserId;

  await tx.transaction.create({
    data: {
      userId: referrerId,
      bookingId: qualifyingBookingId,
      type: TransactionType.earned_grant,
      amount: new Prisma.Decimal(REFERRAL_BONUS_SGD),
      description: `Referral bonus — ${REFERRAL_BONUS_SGD} SGD earned credits (referred user's qualifying booking #${qualifyingBookingId} completed).`,
    },
  });

  await tx.referralSpendBonus.create({
    data: {
      userId: referrerId,
      amount: new Prisma.Decimal(REFERRAL_SPEND_BONUS_SGD),
    },
  });

  await tx.user.update({
    where: { id: refereeUserId },
    data: { referralConvertedAt: new Date() },
  });

  await tx.activityLog.create({
    data: {
      userId: referrerId,
      actionType: ActivityActionType.referral_bonus_earned,
      description: `Referral bonus earned: ${REFERRAL_BONUS_SGD} SGD credits + ${REFERRAL_SPEND_BONUS_SGD} SGD added to your reward-tier spend, from a referred user's qualifying booking.`,
    },
  });
}
