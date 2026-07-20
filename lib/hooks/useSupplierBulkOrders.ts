import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type BulkOrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled";

export interface SupplierBulkOrderRequest {
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
  userName?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export function useSupplierBulkOrders(status?: BulkOrderStatus | "all") {
  const qs = status && status !== "all" ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["supplier-bulk-orders", status ?? "all"],
    queryFn: () => apiFetch<{ bulkOrderRequests: SupplierBulkOrderRequest[] }>(`/api/supplier/bulk-order-requests${qs}`),
    select: (data) => data.bulkOrderRequests,
  });
}

function useInvalidateSupplierBulkOrders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["supplier-bulk-orders"] });
}

export function useConfirmBulkOrder() {
  const invalidate = useInvalidateSupplierBulkOrders();
  return useMutation({
    mutationFn: ({ id, estimatedDeliveryDate }: { id: string; estimatedDeliveryDate: string }) =>
      apiFetch<{ bulkOrderRequest: SupplierBulkOrderRequest }>(`/api/supplier/bulk-order-requests/${id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({ estimatedDeliveryDate }),
      }),
    onSuccess: invalidate,
  });
}

export function useDeclineBulkOrder() {
  const invalidate = useInvalidateSupplierBulkOrders();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ bulkOrderRequest: SupplierBulkOrderRequest }>(`/api/supplier/bulk-order-requests/${id}/decline`, {
        method: "PATCH",
      }),
    onSuccess: invalidate,
  });
}

export function useFulfillBulkOrder() {
  const invalidate = useInvalidateSupplierBulkOrders();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ bulkOrderRequest: SupplierBulkOrderRequest }>(`/api/supplier/bulk-order-requests/${id}/fulfill`, {
        method: "PATCH",
      }),
    onSuccess: invalidate,
  });
}

export function useApproveBulkOrderCancellation() {
  const invalidate = useInvalidateSupplierBulkOrders();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ bulkOrderRequest: SupplierBulkOrderRequest }>(
        `/api/supplier/bulk-order-requests/${id}/approve-cancellation`,
        { method: "PATCH" }
      ),
    onSuccess: invalidate,
  });
}

export function useRejectBulkOrderCancellation() {
  const invalidate = useInvalidateSupplierBulkOrders();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ bulkOrderRequest: SupplierBulkOrderRequest }>(
        `/api/supplier/bulk-order-requests/${id}/reject-cancellation`,
        { method: "PATCH" }
      ),
    onSuccess: invalidate,
  });
}
