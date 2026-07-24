import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
}

export function useAdminPricing() {
  return useQuery({
    queryKey: ["admin-pricing"],
    queryFn: () => apiFetch<AdminPricing>("/api/admin/pricing"),
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
