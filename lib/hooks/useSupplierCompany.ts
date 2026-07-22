import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type SupplierTier = "free" | "preferred" | "top";
export type InvoicingCadence = "monthly" | "biweekly" | "weekly";

// Live-computed, not admin-set (Sprint 6.10) — see lib/supplier-tiers.ts.
// baseTier/tierBoostActive/tierBoostExpiresAt added for the Supplier Rewards
// Catalogue's `system` (Tier Boost) category — same "boost overrides the
// displayed/applied tier only, never freezes the live computation" design as
// the user reward tier's own tierUpgradeActive.
export interface SupplierTierStats {
  averageRating: number | null;
  ratingCount: number;
  spendCredits: number;
  nextTier: SupplierTier | null;
  progressPercent: number;
  baseTier: SupplierTier;
  tierBoostActive: boolean;
  tierBoostExpiresAt: string | null;
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
  // 2026-07-22 fulfillment session — a real company-level credit balance
  // (lib/company-credits.ts), no spend flow yet.
  purchasedCredits: number;
  earnedCredits: number;
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

// Any company member can top up the shared company wallet (confirmed with
// the product owner) — credits-only for now, same posture as the per-user
// wallet top-up (useTopUp, lib/hooks/useWallet.ts).
export function useTopUpCompanyWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch<{ purchasedCredits: number }>("/api/supplier/company/topup", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-company"] }),
  });
}
