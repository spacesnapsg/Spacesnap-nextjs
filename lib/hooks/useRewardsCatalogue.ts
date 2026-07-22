import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { RewardCatalogueItem, RewardCategory } from "@/lib/hooks/useAdminRewards";

// Public counterpart of useAdminRewards — active items only, used by
// RewardsCatalogueModal (Sprint 6.9, replaces the old hardcoded array).
export function useRewardsCatalogue() {
  return useQuery({
    queryKey: ["rewards-catalogue"],
    queryFn: () => apiFetch<{ rewards: RewardCatalogueItem[] }>("/api/rewards"),
    select: (data) => data.rewards,
  });
}

export interface RewardRedemption {
  id: string;
  itemId: string | null;
  itemName: string;
  itemCategory: RewardCategory;
  creditCost: number;
  redeemedAt: string;
}

// The caller's own redemption history — RewardsCatalogueModal's "View
// redeemed rewards" list.
export function useMyRewardRedemptions() {
  return useQuery({
    queryKey: ["reward-redemptions"],
    queryFn: () => apiFetch<{ redemptions: RewardRedemption[] }>("/api/rewards/redemptions"),
    select: (data) => data.redemptions,
  });
}

// Spends earnedBalance on a catalogue item (lib/reward-redemptions.ts).
// Invalidates wallet (earned balance changed), the catalogue (redeemedCount/
// fullyRedeemed changed), and the redemption history all at once — cheaper
// than threading the response through three separate cache updates for a
// low-frequency action.
export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      apiFetch<{ redemption: RewardRedemption }>(`/api/rewards/${itemId}/redeem`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["rewards-catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["reward-redemptions"] });
    },
  });
}
