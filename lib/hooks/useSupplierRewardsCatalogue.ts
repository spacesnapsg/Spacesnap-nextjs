import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { SupplierRewardCatalogueItem, SupplierRewardCategory } from "@/lib/hooks/useAdminSupplierRewards";

// Public (any company member) counterpart of useAdminSupplierRewards —
// active items only, used by SupplierRewardsCatalogueModal (previously its
// hardcoded PLACEHOLDER_REWARDS array).
export function useSupplierRewardsCatalogue() {
  return useQuery({
    queryKey: ["supplier-rewards-catalogue"],
    queryFn: () => apiFetch<{ rewards: SupplierRewardCatalogueItem[] }>("/api/supplier/rewards"),
    select: (data) => data.rewards,
  });
}

export type SupplierRewardRedemptionStatus = "pending" | "used" | "cancelled";

export interface SupplierRewardRedemption {
  id: string;
  itemId: string | null;
  itemName: string;
  itemCategory: SupplierRewardCategory;
  creditCost: number;
  status: SupplierRewardRedemptionStatus;
  expiresAt: string | null;
  redeemedAt: string;
}

// The caller's own company's redemption history — SupplierRewardsCatalogueModal's
// "View redeemed rewards" list.
export function useMySupplierRewardRedemptions() {
  return useQuery({
    queryKey: ["supplier-reward-redemptions"],
    queryFn: () => apiFetch<{ redemptions: SupplierRewardRedemption[] }>("/api/supplier/rewards/redemptions"),
    select: (data) => data.redemptions,
  });
}

// Spends the company's own earned_rebate balance on a catalogue item
// (lib/supplier-reward-redemptions.ts). Invalidates the company details
// query (earnedCredits + tier boost changed), the catalogue
// (redeemedCount/fullyRedeemed changed), and the redemption history all at
// once — same "cheaper than threading the response through separate cache
// updates" reasoning as useRedeemReward.
export function useRedeemSupplierReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      apiFetch<{ redemption: SupplierRewardRedemption }>(`/api/supplier/rewards/${itemId}/redeem`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-company"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-rewards-catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-reward-redemptions"] });
    },
  });
}
