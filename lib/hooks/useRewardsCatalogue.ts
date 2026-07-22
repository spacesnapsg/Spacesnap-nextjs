import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { RewardCatalogueItem } from "@/lib/hooks/useAdminRewards";

// Public counterpart of useAdminRewards — active items only, used by
// RewardsCatalogueModal (Sprint 6.9, replaces the old hardcoded array).
export function useRewardsCatalogue() {
  return useQuery({
    queryKey: ["rewards-catalogue"],
    queryFn: () => apiFetch<{ rewards: RewardCatalogueItem[] }>("/api/rewards"),
    select: (data) => data.rewards,
  });
}
