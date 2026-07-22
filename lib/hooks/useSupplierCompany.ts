import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type SupplierTier = "free" | "preferred" | "top";
export type InvoicingCadence = "monthly" | "biweekly" | "weekly";

// Live-computed, not admin-set (Sprint 6.10) — see lib/supplier-tiers.ts.
export interface SupplierTierStats {
  averageRating: number | null;
  ratingCount: number;
  spendCredits: number;
  nextTier: SupplierTier | null;
  progressPercent: number;
}

export interface CompanyDetails {
  id: string;
  name: string;
  businessName: string | null;
  businessDescription: string | null;
  registrationNumber: string | null;
  financeContactEmail: string | null;
  financeContactPerson: string | null;
  supplierTier: SupplierTier;
  invoicingCadence: InvoicingCadence;
  tierStats: SupplierTierStats;
}

export interface BusinessDetailsFields {
  businessName?: string | null;
  businessDescription?: string | null;
  registrationNumber?: string | null;
  financeContactEmail?: string | null;
  financeContactPerson?: string | null;
}

export function useSupplierCompany() {
  return useQuery({
    queryKey: ["supplier-company"],
    queryFn: () => apiFetch<{ company: CompanyDetails }>("/api/supplier/company"),
    select: (data) => data.company,
  });
}

export function useUpdateSupplierCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: BusinessDetailsFields) =>
      apiFetch<{ company: CompanyDetails }>("/api/supplier/company", {
        method: "PATCH",
        body: JSON.stringify(fields),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-company"] }),
  });
}
