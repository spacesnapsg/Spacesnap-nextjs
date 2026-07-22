import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { REWARD_TIER_WINDOW_MONTHS } from "@/lib/reward-tiers";

// Sprint 6.10 — Supplier Tier automatic calculation, confirmed with the
// product owner 2026-07-22 (chat, same posture as every other "confirmed,
// not guessed" tier decision in this codebase):
//   - Rating: the live average across the company's ENTIRE listed inventory,
//     all-time (not windowed) — same computation already shown on the
//     Supplier Profile page's rating stat, just server-side here.
//   - Spend: gross Booking.sgdAmount of the company's own COMPLETED bookings,
//     over the same rolling window as the user reward tier
//     (REWARD_TIER_WINDOW_MONTHS, lib/reward-tiers.ts) — "should be the same
//     as user tier" per the product owner's own words. Thresholds are given
//     in "credits" on the infographic (components/SupplierTierBenefitsModal.tsx)
//     but stored here as true SGD, converted only at the API edge
//     (sgdToCredits/lib/credit-units.ts) — same discipline as every other
//     money-flow module in this codebase.
//   - BOTH rating AND spend must clear a tier's own thresholds (highest tier
//     whose both conditions are met wins), same "AND, not OR" model as the
//     user reward tier.
// Distinct from the scrapped equipment-certification tier and the user
// reward tier (lib/reward-tiers.ts) — this is the third, separate *supplier
// payment* tier. Never stored denormalized (Company.supplierTier column and
// its manual admin-set route were removed this session — see migration
// `20260722_remove_supplier_tier_column` and CLAUDE1.md's write-up) — same
// "live SUM, never a cached column" principle as getCreditBalance/
// getSupplierPendingPayableBalance/getUserRewardTier.
export type SupplierTier = "free" | "preferred" | "top";

interface SupplierTierDefinition {
  tier: SupplierTier;
  minRating: number;
  minSpendSgd: number;
}

// Highest tier first — computeSupplierTier evaluates in this order and
// returns the first (i.e. highest) tier whose BOTH thresholds are met.
// Numbers per the product-owner-provided infographic (50,000/100,000
// credits spend = S$5,000/S$10,000 at CREDITS_PER_SGD=10, 4.0/4.5 avg
// rating), confirmed correct 2026-07-22.
const SUPPLIER_TIERS: SupplierTierDefinition[] = [
  { tier: "top", minRating: 4.5, minSpendSgd: 10_000 },
  { tier: "preferred", minRating: 4.0, minSpendSgd: 5_000 },
  { tier: "free", minRating: 0, minSpendSgd: 0 },
];

const SUPPLIER_TIER_ORDER: SupplierTier[] = ["free", "preferred", "top"];

export function computeSupplierTier(averageRating: number | null, spendSgd: number): SupplierTier {
  const rating = averageRating ?? 0;
  for (const def of SUPPLIER_TIERS) {
    if (rating >= def.minRating && spendSgd >= def.minSpendSgd) {
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
  averageRating: number | null;
  ratingCount: number;
  spendSgd: number;
}

// Live-computed, never stored denormalized. Rating is all-time (no window —
// not confirmed to be windowed, unlike spend); spend is the rolling window
// sum of the company's own completed bookings' headline sgdAmount, same
// source/shape as getUserRewardTierWindowStats.
export async function getCompanySupplierTierStats(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  asOf: Date = new Date()
): Promise<SupplierTierStats> {
  const start = windowStart(asOf);

  const [ratingAgg, spendAgg] = await Promise.all([
    client.rating.aggregate({
      where: { listing: { companyId } },
      _avg: { score: true },
      _count: { _all: true },
    }),
    client.booking.aggregate({
      where: { listing: { companyId }, status: "completed", completedAt: { gte: start } },
      _sum: { sgdAmount: true },
    }),
  ]);

  return {
    averageRating: ratingAgg._avg.score,
    ratingCount: ratingAgg._count._all,
    spendSgd: Number(spendAgg._sum.sgdAmount ?? new Prisma.Decimal(0)),
  };
}

export interface SupplierTierStatus {
  tier: SupplierTier;
  averageRating: number | null;
  ratingCount: number;
  spendSgd: number;
  nextTier: SupplierTier | null;
  // 0-100 progress bar toward nextTier. Both rating AND spend must be met,
  // so progress is bottlenecked by whichever criterion is furthest behind —
  // same "min of both ratios" idiom as getUserRewardTier's progressPercent.
  // 100 for the top tier, which has no nextTier to progress toward.
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
  const baseTier = computeSupplierTier(stats.averageRating, stats.spendSgd);

  const tierBoostExpiresAt = await getActiveTierBoostExpiry(companyId, client, asOf);
  // Already-top boosts are a harmless no-op — nextTier(baseTier) is null, so
  // `?? baseTier` leaves the tier unchanged.
  const tier = tierBoostExpiresAt ? nextTier(baseTier) ?? baseTier : baseTier;

  const next = nextTier(tier);
  const nextDef = next ? SUPPLIER_TIERS.find((def) => def.tier === next)! : null;

  const progressPercent = nextDef
    ? Math.round(
        Math.min(
          Math.min(1, (stats.averageRating ?? 0) / nextDef.minRating),
          Math.min(1, stats.spendSgd / nextDef.minSpendSgd)
        ) * 100
      )
    : 100;

  return {
    tier,
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    spendSgd: stats.spendSgd,
    nextTier: next,
    progressPercent,
    baseTier,
    tierBoostActive: tierBoostExpiresAt !== null,
    tierBoostExpiresAt,
  };
}
