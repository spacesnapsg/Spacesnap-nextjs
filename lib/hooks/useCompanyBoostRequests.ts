import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface CompanyBoostRequest {
  id: string;
  type: "bump" | "pin";
  status: "pending" | "fulfilled" | "declined";
  requestedBy: { id: string; name: string; email: string };
  quantity: number | null;
  listingId: string | null;
  listingName: string | null;
  durationDays: number | null;
  declineReason: string | null;
  createdAt: string;
}

function useInvalidateCompanyBoostRequests() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["company-boost-requests"] });
    queryClient.invalidateQueries({ queryKey: ["supplier-company"] });
    queryClient.invalidateQueries({ queryKey: ["supplier-listings"] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
  };
}

export function useCompanyBoostRequests(enabled: boolean, status?: string) {
  const params = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["company-boost-requests", status],
    queryFn: () => apiFetch<{ requests: CompanyBoostRequest[] }>(`/api/supplier/company/boost-requests${params}`),
    select: (data) => data.requests,
    enabled,
  });
}

export type CreateCompanyBoostRequestInput =
  | { type: "bump"; quantity: number }
  | { type: "pin"; listingId: string; durationDays: 7 | 30 };

export function useCreateCompanyBoostRequest() {
  const invalidate = useInvalidateCompanyBoostRequests();
  return useMutation({
    mutationFn: (input: CreateCompanyBoostRequestInput) =>
      apiFetch("/api/supplier/company/boost-requests", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useFulfillCompanyBoostRequest() {
  const invalidate = useInvalidateCompanyBoostRequests();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/supplier/company/boost-requests/${id}/fulfill`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useDeclineCompanyBoostRequest() {
  const invalidate = useInvalidateCompanyBoostRequests();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/api/supplier/company/boost-requests/${id}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: invalidate,
  });
}
