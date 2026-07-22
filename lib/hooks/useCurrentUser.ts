import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Sprint 6.5 — User Reward Tier. Structured (tier/rebate/progress), never a
// bare balance — see GET /api/me's own comment and
// lib/earned-balance-guard.test.ts for why.
export interface CurrentUserRewardTier {
  tier: "free" | "starter" | "growth" | "power";
  rebatePercent: number;
  bookingCount: number;
  spendCredits: number;
  nextTier: "starter" | "growth" | "power" | null;
  bookingsToNextTier: number | null;
  spendCreditsToNextTier: number | null;
  progressPercent: number;
  // 2026-07-22 — set when a redeemed Premium Tier Upgrade is boosting `tier`
  // above what the live rolling-window computation alone would produce.
  baseTier: "free" | "starter" | "growth" | "power";
  tierUpgradeActive: boolean;
  tierUpgradeExpiresAt: string | null;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  title: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  memberSince: string;
  promotionRequested: boolean;
  referralCode: string;
  rewardTier: CurrentUserRewardTier;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentUser>("/api/me"),
  });
}
