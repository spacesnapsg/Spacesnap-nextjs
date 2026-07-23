import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface AdminEdmCampaign {
  id: string;
  imageUrl: string;
  caption: string | null;
  targetMembers: boolean;
  targetSuppliers: boolean;
  createdAt: string;
}

export interface AdminEdmCampaignInput {
  imageKey: string;
  caption?: string | null;
  targetMembers: boolean;
  targetSuppliers: boolean;
}

export function useAdminEdmCampaign() {
  return useQuery({
    queryKey: ["admin-edm-campaign"],
    queryFn: () => apiFetch<{ campaign: AdminEdmCampaign | null }>("/api/admin/edm-campaign"),
    select: (data) => data.campaign,
  });
}

export function useAdminSetEdmCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminEdmCampaignInput) =>
      apiFetch<{ campaign: AdminEdmCampaign }>("/api/admin/edm-campaign", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-edm-campaign"] }),
  });
}
