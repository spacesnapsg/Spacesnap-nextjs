import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// The membership/consultancy enquiry queue on the Admin Overview page —
// pending requests from components/CustomRequirementsModal.tsx still
// awaiting a system admin to follow up out-of-platform.
export interface PendingMarketplaceEnquiry {
  id: string;
  type: "membership" | "consultancy";
  details: string;
  contactEmail: string | null;
  createdAt: string;
  requestedBy: { name: string; email: string; companyName: string | null };
}

export function usePendingMarketplaceEnquiries() {
  return useQuery({
    queryKey: ["admin-marketplace-enquiries"],
    queryFn: () => apiFetch<{ enquiries: PendingMarketplaceEnquiry[] }>("/api/admin/marketplace-enquiries"),
    select: (data) => data.enquiries,
  });
}

export function useResolveMarketplaceEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/admin/marketplace-enquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status: "fulfilled" }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-marketplace-enquiries"] }),
  });
}
