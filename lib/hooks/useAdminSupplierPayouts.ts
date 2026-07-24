import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { SupplierPayoutStatus } from "@/lib/hooks/useSupplierPayouts";

export interface PendingPayableCompany {
  companyId: string;
  companyName: string;
  pendingTotal: number;
  oldestPendingSince: string | null;
}

export interface AdminSupplierPayout {
  id: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: SupplierPayoutStatus;
  xeroBillUrl: string | null;
  xeroRemittanceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminSupplierPayoutsData {
  pendingCompanies: PendingPayableCompany[];
  awaitingPayment: AdminSupplierPayout[];
}

// System-admin-only. Backs the "Supplier Payouts" card on the admin
// Financials page (app/(admin)/admin-financials/page.tsx).
export function useAdminSupplierPayouts() {
  return useQuery({
    queryKey: ["admin-supplier-payouts"],
    queryFn: () => apiFetch<AdminSupplierPayoutsData>("/api/admin/supplier-payouts"),
  });
}

export function useCreateSupplierPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId: string; periodStart: string; periodEnd: string; xeroBillUrl?: string }) =>
      apiFetch("/api/admin/supplier-payouts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-supplier-payouts"] }),
  });
}

export function useSetSupplierPayoutBillUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, xeroBillUrl }: { id: string; xeroBillUrl: string }) =>
      apiFetch(`/api/admin/supplier-payouts/${id}`, { method: "PATCH", body: JSON.stringify({ xeroBillUrl }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-supplier-payouts"] }),
  });
}

export function useMarkSupplierPayoutPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, xeroRemittanceUrl }: { id: string; xeroRemittanceUrl: string }) =>
      apiFetch(`/api/admin/supplier-payouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", xeroRemittanceUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-supplier-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payouts"] });
    },
  });
}
