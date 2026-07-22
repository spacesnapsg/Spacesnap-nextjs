import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type RewardCategory = "discount" | "pitch_ticket" | "consultancy" | "events" | "lucky_draw" | "tier_upgrade" | "consumable";

export type RewardDiscountAppliesTo = "booking" | "equipment" | "certification_fee";

export interface RewardCatalogueItem {
  id: string;
  category: RewardCategory;
  name: string;
  description: string;
  active: boolean;
  creditCost: number;
  quantityAvailable: number | null;
  redeemedCount: number;
  fullyRedeemed: boolean;
  discountPercent: number | null;
  discountAppliesTo: RewardDiscountAppliesTo[];
  partnerName: string | null;
  consultancySubject: string | null;
  eventName: string | null;
  eventInfo: string | null;
  prizeDescription: string | null;
  prizeQuantity: number | null;
  upgradeDurationMonths: number | null;
  consumableName: string | null;
  consumableQuantity: number | null;
}

export interface RewardCatalogueItemInput {
  category: RewardCategory;
  name: string;
  description: string;
  active?: boolean;
  creditCost?: number;
  quantityAvailable?: number | null;
  discountPercent?: number | null;
  discountAppliesTo?: RewardDiscountAppliesTo[];
  partnerName?: string | null;
  consultancySubject?: string | null;
  eventName?: string | null;
  eventInfo?: string | null;
  prizeDescription?: string | null;
  prizeQuantity?: number | null;
  upgradeDurationMonths?: number | null;
  consumableName?: string | null;
  consumableQuantity?: number | null;
}

export function useAdminRewards() {
  return useQuery({
    queryKey: ["admin-rewards"],
    queryFn: () => apiFetch<{ rewards: RewardCatalogueItem[] }>("/api/admin/rewards"),
    select: (data) => data.rewards,
  });
}

export function useAdminCreateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RewardCatalogueItemInput) =>
      apiFetch<{ reward: RewardCatalogueItem }>("/api/admin/rewards", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-rewards"] }),
  });
}

export function useAdminUpdateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<RewardCatalogueItemInput> & { id: string }) =>
      apiFetch<{ reward: RewardCatalogueItem }>(`/api/admin/rewards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-rewards"] }),
  });
}

export function useAdminDeleteReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/rewards/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-rewards"] }),
  });
}
