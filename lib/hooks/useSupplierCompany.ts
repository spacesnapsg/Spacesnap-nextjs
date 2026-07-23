import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Client-safe mirror of lib/company-credits.ts's BUMP_UNIT_COST_CREDITS —
// that file imports prisma and can't be imported into a client component.
// Display-only; the server route is what actually enforces/charges this.
// Placeholder pricing, same flagged status as the server-side constant.
export const BUMP_UNIT_COST_CREDITS_DISPLAY = 50;

export type SupplierTier = "free" | "preferred" | "top";
export type PayoutCadence = "monthly" | "biweekly" | "weekly";

// Live-computed, not admin-set (Sprint 6.10) — see lib/supplier-tiers.ts.
// baseTier/tierBoostActive/tierBoostExpiresAt added for the Supplier Rewards
// Catalogue's `system` (Tier Boost) category — same "boost overrides the
// displayed/applied tier only, never freezes the live computation" design as
// the user reward tier's own tierUpgradeActive.
export interface SupplierTierStats {
  bookingCount: number;
  cancelledCount: number;
  cancellationRate: number;
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
  payoutCadence: PayoutCadence;
  tierStats: SupplierTierStats;
  // 2026-07-22 fulfillment session — a real company-level credit balance
  // (lib/company-credits.ts), no spend flow yet.
  purchasedCredits: number;
  earnedCredits: number;
  // Sprint 6.12 — Bumps "ammo" count, spent via useActivateBump below.
  bumpsAvailable: number;
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

// Sprint 6.12 — buys Bumps "ammo" (requireCompanyAdmin at the route layer,
// spending shared funds).
export function usePurchaseBumps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quantity: number) =>
      apiFetch<{ bumpsAvailable: number }>("/api/supplier/company/bumps/purchase", {
        method: "POST",
        body: JSON.stringify({ quantity }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-company"] }),
  });
}

// Spends one Bump on a single listing (requireSupplier — any team member,
// see activateBump's own comment). Invalidates both the company (bumps
// count dropped) and the supplier listings feed (boostedAt changed).
export function useActivateBump() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => apiFetch<{ boostedAt: string }>(`/api/supplier/listings/${listingId}/bump`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-company"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

// Buys a 7- or 30-day Pin and applies it to one of the company's own
// listings in the same action (requireCompanyAdmin — spending shared
// funds, same reasoning as Bumps' purchase gate).
export function usePurchasePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { listingId: string; durationDays: 7 | 30 }) =>
      apiFetch("/api/supplier/company/pins/purchase", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-company"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
