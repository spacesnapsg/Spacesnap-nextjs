import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ActiveEdmCampaign {
  source: "admin" | "supplier";
  imageUrl: string;
  caption: string | null;
}

// Fetched once per layout mount (no polling, unlike notifications) — a
// deliberate simplification, see getActiveEdmForUser's own comment. A full
// page load after 6+ idle hours re-triggers this the same way a fresh
// sign-in does; a long-idle tab that's never reloaded won't.
export function useCurrentEdmCampaign() {
  return useQuery({
    queryKey: ["edm-campaign-current"],
    queryFn: () => apiFetch<{ campaign: ActiveEdmCampaign | null }>("/api/edm-campaigns/current"),
    select: (data) => data.campaign,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useDismissEdmCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/edm-campaigns/dismiss", { method: "PATCH" }),
    onSuccess: () => queryClient.setQueryData(["edm-campaign-current"], { campaign: null }),
  });
}
