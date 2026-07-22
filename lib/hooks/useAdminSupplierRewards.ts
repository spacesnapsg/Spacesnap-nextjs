import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type SupplierRewardCategory = "report" | "ad" | "system";

export type SupplierReportTargetGroup = "bookings" | "equipment" | "consumables";

export interface SupplierRewardCatalogueItem {
  id: string;
  category: SupplierRewardCategory;
  name: string;
  description: string;
  active: boolean;
  creditCost: number;
  quantityAvailable: number | null;
  redeemedCount: number;
  fullyRedeemed: boolean;
  reportTargetGroups: SupplierReportTargetGroup[];
  campaignDurationDays: number | null;
  upgradeDurationMonths: number | null;
}

export interface SupplierRewardCatalogueItemInput {
  category: SupplierRewardCategory;
  name: string;
  description: string;
  active?: boolean;
  creditCost?: number;
  quantityAvailable?: number | null;
  reportTargetGroups?: SupplierReportTargetGroup[];
  campaignDurationDays?: number | null;
  upgradeDurationMonths?: number | null;
}

export function useAdminSupplierRewards() {
  return useQuery({
    queryKey: ["admin-supplier-rewards"],
    queryFn: () => apiFetch<{ rewards: SupplierRewardCatalogueItem[] }>("/api/admin/supplier-rewards"),
    select: (data) => data.rewards,
  });
}

export function useAdminCreateSupplierReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierRewardCatalogueItemInput) =>
      apiFetch<{ reward: SupplierRewardCatalogueItem }>("/api/admin/supplier-rewards", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-supplier-rewards"] }),
  });
}

export function useAdminUpdateSupplierReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<SupplierRewardCatalogueItemInput> & { id: string }) =>
      apiFetch<{ reward: SupplierRewardCatalogueItem }>(`/api/admin/supplier-rewards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-supplier-rewards"] }),
  });
}

export function useAdminDeleteSupplierReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/supplier-rewards/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-supplier-rewards"] }),
  });
}
