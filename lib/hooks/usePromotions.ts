import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface PendingPromotion {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  companyName: string | null;
}

// Self-service: the caller (a supplier) requests promotion to company admin.
export function useRequestPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ promotionRequested: boolean }>("/api/promotion-request", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function usePendingPromotions() {
  return useQuery({
    queryKey: ["admin-promotions-pending"],
    queryFn: () => apiFetch<{ promotions: PendingPromotion[] }>("/api/admin/promotions/pending"),
    select: (data) => data.promotions,
  });
}

function useInvalidatePendingPromotions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin-promotions-pending"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };
}

export function useApprovePromotion() {
  const invalidate = useInvalidatePendingPromotions();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/admin/promotions/${userId}/approve`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useRejectPromotion() {
  const invalidate = useInvalidatePendingPromotions();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/admin/promotions/${userId}/reject`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}
