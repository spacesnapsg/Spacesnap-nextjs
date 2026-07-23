import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Mirrors lib/hooks/usePromotions.ts, scoped to BuyerOrganization instead of
// Company — the system-admin queue for org-admin promotion requests, only
// ever populated when an org has no admin at all yet
// (lib/buyer-organizations.ts's requestBuyerOrgPromotion enforces that gate).
export interface PendingBuyerOrgPromotion {
  id: string;
  name: string;
  email: string;
  buyerOrganizationId: string | null;
  buyerOrganizationName: string | null;
}

export function usePendingBuyerOrgPromotions() {
  return useQuery({
    queryKey: ["admin-buyer-org-promotions-pending"],
    queryFn: () =>
      apiFetch<{ promotions: PendingBuyerOrgPromotion[] }>("/api/admin/buyer-org-promotions/pending"),
    select: (data) => data.promotions,
  });
}

function useInvalidatePendingBuyerOrgPromotions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin-buyer-org-promotions-pending"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };
}

export function useApproveBuyerOrgPromotion() {
  const invalidate = useInvalidatePendingBuyerOrgPromotions();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/admin/buyer-org-promotions/${userId}/approve`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useRejectBuyerOrgPromotion() {
  const invalidate = useInvalidatePendingBuyerOrgPromotions();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/admin/buyer-org-promotions/${userId}/reject`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}
