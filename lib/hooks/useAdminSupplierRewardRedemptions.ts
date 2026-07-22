import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// The report/ad "concierge" queue on the Admin Overview page — pending
// supplier redemptions still awaiting the admin generating the report /
// arranging the ad placement. Company-scoped sibling of
// PendingConciergeRedemption (lib/hooks/useAdminRewardRedemptions.ts).
export interface PendingSupplierConciergeRedemption {
  id: string;
  itemName: string;
  itemCategory: "report" | "ad";
  redeemedAt: string;
  company: { name: string };
  redeemedByUser: { name: string; email: string };
}

export function usePendingSupplierConciergeRedemptions() {
  return useQuery({
    queryKey: ["admin-supplier-reward-redemptions"],
    queryFn: () => apiFetch<{ redemptions: PendingSupplierConciergeRedemption[] }>("/api/admin/supplier-reward-redemptions"),
    select: (data) => data.redemptions,
  });
}

export function useResolveSupplierRewardRedemption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "used" | "cancelled" }) =>
      apiFetch(`/api/admin/supplier-reward-redemptions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-supplier-reward-redemptions"] }),
  });
}
