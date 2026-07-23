import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { REWARD_TIER_WINDOW_MONTHS } from "@/lib/reward-tiers";

// Sprint 6.10 — Supplier Tier automatic calculation, confirmed with the
// product owner 2026-07-22, criteria revised 2026-07-23 (rating swapped for
// booking volume + cancellation rate — same posture as every other
// "confirmed, not guessed" tier decision in this codebase):
//   - Bookings: count of the company's own COMPLETED bookings, over the same
//     rolling window as the user reward tier (REWARD_TIER_WINDOW_MONTHS,
//     lib/reward-tiers.ts) — "should be the same as user tier" per the
//     product owner's own words, same window spend already used.
//   - Cancellation rate: cancelledCount / (completedCount + cancelledCount)
//     over that same window — a MAX threshold (lower is better), unlike the
//     other two MIN thresholds. Zero finalized bookings in the window scores
//     0% (no data to penalize on, not a false 100%).
//   - Spend: gross Booking.sgdAmount of the company's own COMPLETED bookings,
//     same window. Thresholds are given in "credits" on the product owner's
//     own numbers but stored here as true SGD, converted only at the API
//     edge (sgdToCredits/lib/credit-units.ts) — same discipline as every
//     other money-flow module in this codebase.
//   - ALL THREE must clear a tier's own thresholds (highest tier whose every
//     condition is met wins), same "AND, not OR" model as the user reward
//     tier.
// Distinct from the scrapped equipment-certification tier and the user
// reward tier (lib/reward-tiers.ts) — this is the third, separate *supplier
// payment* tier. Never stored denormalized (Company.supplierTier column and
// its manual admin-set route were removed 2026-07-22 — see migration
// `20260722_remove_supplier_tier_column` and CLAUDE1.md's write-up) — same
// "live SUM, never a cached column" principle as getCreditBalance/
// getSupplierPendingPayableBalance/getUserRewardTier.
export type SupplierTier = "free" | "preferred" | "top";

interface SupplierTierDefinition {
  tier: SupplierTier;
  minBookings: number;
  maxCancellationRate: number; // e.g. 0.10 = under 10%, strict less-than
  minSpendSgd: number;
}

// Highest tier first — computeSupplierTier evaluates in this order and
// returns the first (i.e. highest) tier whose thresholds are ALL met.
// Numbers per the product owner, confirmed 2026-07-23: preferred = min 50
// bookings, <10% cancellation rate, 50,000 credits (S$5,000 at
// CREDITS_PER_SGD=10) spend; top = min 100 bookings, <3% cancellation rate,
// 100,000 credits (S$10,000) spend.
const SUPPLIER_TIERS: SupplierTierDefinition[] = [
  { tier: "top", minBookings: 100, maxCancellationRate: 0.03, minSpendSgd: 10_000 },
  { tier: "preferred", minBookings: 50, maxCancellationRate: 0.1, minSpendSgd: 5_000 },
  { tier: "free", minBookings: 0, maxCancellationRate: 1, minSpendSgd: 0 },
];

const SUPPLIER_TIER_ORDER: SupplierTier[] = ["free", "preferred", "top"];

export function computeSupplierTier(bookingCount: number, cancellationRate: number, spendSgd: number): SupplierTier {
  for (const def of SUPPLIER_TIERS) {
    if (bookingCount >= def.minBookings && cancellationRate < def.maxCancellationRate && spendSgd >= def.minSpendSgd) {
      return def.tier;
    }
  }
  return "free";
}

function nextTier(tier: SupplierTier): SupplierTier | null {
  const index = SUPPLIER_TIER_ORDER.indexOf(tier);
  return index < SUPPLIER_TIER_ORDER.length - 1 ? SUPPLIER_TIER_ORDER[index + 1] : null;
}

function windowStart(asOf: Date): Date {
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() - REWARD_TIER_WINDOW_MONTHS);
  return d;
}

export interface SupplierTierStats {
  bookingCount: number;
  cancelledCount: number;
  cancellationRate: number;
  spendSgd: number;
}

// Live-computed, never stored denormalized. All three figures share the same
// rolling window (REWARD_TIER_WINDOW_MONTHS) — bookingCount/spendSgd off the
// company's own COMPLETED bookings, cancelledCount off its CANCELLED ones,
// cancellationRate = cancelledCount / (bookingCount + cancelledCount), 0 when
// there are no finalized bookings yet in the window (no data to penalize on).
export async function getCompanySupplierTierStats(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  asOf: Date = new Date()
): Promise<SupplierTierStats> {
  const start = windowStart(asOf);

  const [completedAgg, cancelledCount] = await Promise.all([
    client.booking.aggregate({
      where: { listing: { companyId }, status: "completed", completedAt: { gte: start } },
      _sum: { sgdAmount: true },
      _count: { _all: true },
    }),
    client.booking.count({
      where: { listing: { companyId }, status: "cancelled", cancelledAt: { gte: start } },
    }),
  ]);

  const bookingCount = completedAgg._count._all;
  const totalFinalized = bookingCount + cancelledCount;

  return {
    bookingCount,
    cancelledCount,
    cancellationRate: totalFinalized > 0 ? cancelledCount / totalFinalized : 0,
    spendSgd: Number(completedAgg._sum.sgdAmount ?? new Prisma.Decimal(0)),
  };
}

export interface SupplierTierStatus {
  tier: SupplierTier;
  bookingCount: number;
  cancelledCount: number;
  cancellationRate: number;
  spendSgd: number;
  nextTier: SupplierTier | null;
  // 0-100 progress bar toward nextTier. ALL THREE criteria must be met, so
  // progress is bottlenecked by whichever is furthest behind — same "min of
  // all ratios" idiom as getUserRewardTier's progressPercent. Cancellation
  // rate is a MAX threshold (lower is better) unlike the other two MIN
  // thresholds, so its ratio is inverted: fully met (1) once under the cap,
  // otherwise how much of the cap the current rate still exceeds by
  // (maxCancellationRate / cancellationRate) rather than a straight
  // current/target ratio. 100 for the top tier, which has no nextTier to
  // progress toward.
  progressPercent: number;
  // The tier the live rating+spend computation alone would produce, with no
  // Tier Boost (Supplier Rewards Catalogue, category `system`) applied — see
  // tierBoostActive below. Equal to `tier` whenever no boost is active. Same
  // "override the effective tier only, never freeze/reset the underlying
  // computation" design as the user reward tier's own tier_upgrade boost
  // (lib/reward-tiers.ts's baseTier/tierUpgradeActive).
  baseTier: SupplierTier;
  tierBoostActive: boolean;
  tierBoostExpiresAt: Date | null;
}

// 2026-07-23 (Supplier Rewards Catalogue, category `system` — "Tier Boost"):
// a redeemed boost bumps the company's EFFECTIVE tier one level up for its
// duration, same non-freezing design as getUserRewardTier's tier_upgrade
// boost — see that function's own comment for the full reasoning.
async function getActiveTierBoostExpiry(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma,
  asOf: Date
): Promise<Date | null> {
  const active = await client.supplierRewardRedemption.findFirst({
    where: { companyId, itemCategory: "system", expiresAt: { gt: asOf } },
    orderBy: { expiresAt: "desc" },
  });
  return active?.expiresAt ?? null;
}

export async function getCompanySupplierTier(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  asOf: Date = new Date()
): Promise<SupplierTierStatus> {
  const stats = await getCompanySupplierTierStats(companyId, client, asOf);
  const baseTier = computeSupplierTier(stats.bookingCount, stats.cancellationRate, stats.spendSgd);

  const tierBoostExpiresAt = await getActiveTierBoostExpiry(companyId, client, asOf);
  // Already-top boosts are a harmless no-op — nextTier(baseTier) is null, so
  // `?? baseTier` leaves the tier unchanged.
  const tier = tierBoostExpiresAt ? nextTier(baseTier) ?? baseTier : baseTier;

  const next = nextTier(tier);
  const nextDef = next ? SUPPLIER_TIERS.find((def) => def.tier === next)! : null;

  const cancellationRateRatio = nextDef
    ? stats.cancellationRate < nextDef.maxCancellationRate
      ? 1
      : Math.min(1, nextDef.maxCancellationRate / stats.cancellationRate)
    : 1;

  const progressPercent = nextDef
    ? Math.round(
        Math.min(
          Math.min(1, stats.bookingCount / nextDef.minBookings),
          cancellationRateRatio,
          Math.min(1, stats.spendSgd / nextDef.minSpendSgd)
        ) * 100
      )
    : 100;

  return {
    tier,
    bookingCount: stats.bookingCount,
    cancelledCount: stats.cancelledCount,
    cancellationRate: stats.cancellationRate,
    spendSgd: stats.spendSgd,
    nextTier: next,
    progressPercent,
    baseTier,
    tierBoostActive: tierBoostExpiresAt !== null,
    tierBoostExpiresAt,
  };
}
