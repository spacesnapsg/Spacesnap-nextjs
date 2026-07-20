import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type BulkOrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled";

export interface MyBulkOrderRequest {
  id: string;
  userId: string;
  listingId: string;
  quantity: number;
  credits: number;
  status: BulkOrderStatus;
  estimatedDeliveryDate: string | null;
  cancellationRequestedAt: string | null;
  cancellationReason: string | null;
  listingName?: string;
  createdAt: string;
  updatedAt: string;
}

export function useMyBulkOrders(status?: BulkOrderStatus | "all") {
  const qs = status && status !== "all" ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["my-bulk-orders", status ?? "all"],
    queryFn: () => apiFetch<{ bulkOrderRequests: MyBulkOrderRequest[] }>(`/api/bulk-order-requests${qs}`),
    select: (data) => data.bulkOrderRequests,
  });
}

function useInvalidateMyBulkOrders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["my-bulk-orders"] });
}

// Only valid while the request is still `pending` — see
// cancelBulkOrderByUser, lib/bulk-orders.ts.
export function useCancelMyBulkOrder() {
  const invalidate = useInvalidateMyBulkOrders();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ bulkOrderRequest: MyBulkOrderRequest }>(`/api/bulk-order-requests/${id}/cancel`, {
        method: "PATCH",
      }),
    onSuccess: invalidate,
  });
}

// Only valid once the request is `confirmed` — requires supplier approval,
// see requestBulkOrderCancellation, lib/bulk-orders.ts.
export function useRequestBulkOrderCancellation() {
  const invalidate = useInvalidateMyBulkOrders();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<{ bulkOrderRequest: MyBulkOrderRequest }>(`/api/bulk-order-requests/${id}/request-cancellation`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: invalidate,
  });
}
