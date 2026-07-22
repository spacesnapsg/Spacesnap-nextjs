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

export type RewardRedemptionStatus = "pending" | "used" | "cancelled";

export interface RewardRedemption {
  id: string;
  itemId: string | null;
  itemName: string;
  itemCategory: RewardCategory;
  creditCost: number;
  status: RewardRedemptionStatus;
  selectedPartnerOption: string | null;
  expiresAt: string | null;
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

export interface RewardGrant {
  id: string;
  type: "booking_discount_pct" | "free_consumable_unit" | "gig_payout_credit";
  value: number;
  grantedVia: string;
  expiresAt: string | null;
  createdAt: string;
}

// The caller's own available (unexpired) RewardGrant rows — the "Have a
// voucher?" checkout dropdown in BookingModal. A redeemed Discount Voucher
// only shows up here (2026-07-22 fulfillment session).
export function useMyRewardGrants() {
  return useQuery({
    queryKey: ["reward-grants"],
    queryFn: () => apiFetch<{ grants: RewardGrant[] }>("/api/rewards/grants"),
    select: (data) => data.grants,
  });
}

// Spends earnedBalance on a catalogue item (lib/reward-redemptions.ts).
// `selectedPartnerOption` is required by the server for pitch_ticket/
// consultancy items only — every other category ignores it.
// Invalidates wallet (earned balance changed), the catalogue (redeemedCount/
// fullyRedeemed changed), the redemption history, and available grants
// (a discount redemption mints one) all at once — cheaper than threading the
// response through four separate cache updates for a low-frequency action.
export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, selectedPartnerOption }: { itemId: string; selectedPartnerOption?: string }) =>
      apiFetch<{ redemption: RewardRedemption }>(`/api/rewards/${itemId}/redeem`, {
        method: "POST",
        body: JSON.stringify({ selectedPartnerOption }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["rewards-catalogue"] });
      queryClient.invalidateQueries({ queryKey: ["reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["reward-grants"] });
    },
  });
}
