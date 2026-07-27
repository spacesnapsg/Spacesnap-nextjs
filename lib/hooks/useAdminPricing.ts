import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type PricingField =
  | "bookingMarkupDailyPercent"
  | "bookingMarkupWeeklyPercent"
  | "bookingMarkupMonthlyPercent"
  | "bookingCommissionPercent"
  | "consumablesCommissionPercent";

export const PRICING_FIELDS: PricingField[] = [
  "bookingMarkupDailyPercent",
  "bookingMarkupWeeklyPercent",
  "bookingMarkupMonthlyPercent",
  "bookingCommissionPercent",
  "consumablesCommissionPercent",
];

export const PRICING_FIELD_LABELS: Record<PricingField, string> = {
  bookingMarkupDailyPercent: "Daily markup",
  bookingMarkupWeeklyPercent: "Weekly markup",
  bookingMarkupMonthlyPercent: "Monthly markup",
  bookingCommissionPercent: "Booking commission",
  consumablesCommissionPercent: "Consumables commission",
};

export interface PlatformPricingConfig {
  bookingMarkupDailyPercent: number;
  bookingMarkupWeeklyPercent: number;
  bookingMarkupMonthlyPercent: number;
  bookingCommissionPercent: number;
  consumablesCommissionPercent: number;
  updatedAt: string;
}

export interface CompanyPricing {
  companyId: string;
  companyName: string;
  overrides: Record<PricingField, number | null>;
  effective: Record<PricingField, number>;
}

interface AdminPricing {
  config: PlatformPricingConfig;
  companies: CompanyPricing[];
  meta: { page: number; perPage: number; total: number };
}

interface AdminPricingFilters {
  search?: string;
  page?: number;
}

export function useAdminPricing(filters: AdminPricingFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  const qs = params.toString();

  return useQuery({
    queryKey: ["admin-pricing", filters],
    queryFn: () => apiFetch<AdminPricing>(`/api/admin/pricing${qs ? `?${qs}` : ""}`),
    // Without this, every search keystroke makes `data` briefly undefined,
    // which unmounts the search input itself (behind the card's `!data`
    // loading gate) — see the same fix on useAdminFinancials.
    placeholderData: keepPreviousData,
  });
}

export function useUpdatePlatformPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Record<PricingField, number>>) =>
      apiFetch<{ config: PlatformPricingConfig }>("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pricing"] }),
  });
}

export function useUpdateCompanyPricing() {
  const qc = useQueryClient();
  return useMutation({
    // A field set to null clears the override (reverts to the platform
    // default); an omitted field is left unchanged.
    mutationFn: ({ companyId, patch }: { companyId: string; patch: Partial<Record<PricingField, number | null>> }) =>
      apiFetch<{ company: CompanyPricing }>(`/api/admin/pricing/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pricing"] }),
  });
}
