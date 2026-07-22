import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// The pitch_ticket/consultancy "concierge" queue on the Admin Overview page
// (2026-07-22 fulfillment session) — pending redemptions still awaiting the
// admin arranging scheduling with the user's chosen partner.
export interface PendingConciergeRedemption {
  id: string;
  itemName: string;
  itemCategory: "pitch_ticket" | "consultancy";
  selectedPartnerOption: string | null;
  redeemedAt: string;
  user: { name: string; email: string };
}

export function usePendingConciergeRedemptions() {
  return useQuery({
    queryKey: ["admin-reward-redemptions"],
    queryFn: () => apiFetch<{ redemptions: PendingConciergeRedemption[] }>("/api/admin/reward-redemptions"),
    select: (data) => data.redemptions,
  });
}

export function useResolveRewardRedemption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "used" | "cancelled" }) =>
      apiFetch(`/api/admin/reward-redemptions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reward-redemptions"] }),
  });
}
