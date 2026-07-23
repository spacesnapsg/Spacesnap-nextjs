import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface SupplierEdmCampaign {
  id: string;
  imageUrl: string;
  caption: string | null;
  updatedAt: string;
}

export function useSupplierEdmCampaign() {
  return useQuery({
    queryKey: ["supplier-edm-campaign"],
    queryFn: () => apiFetch<{ campaign: SupplierEdmCampaign | null }>("/api/supplier/edm-campaign"),
    select: (data) => data.campaign,
  });
}

export function useSetSupplierEdmCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { imageKey: string; caption?: string | null }) =>
      apiFetch<{ campaign: SupplierEdmCampaign }>("/api/supplier/edm-campaign", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-edm-campaign"] }),
  });
}
