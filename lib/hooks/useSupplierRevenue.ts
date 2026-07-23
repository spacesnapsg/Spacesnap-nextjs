import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface RevenueByTypeMonth {
  month: string; // "YYYY-MM"
  space: number;
  equipment: number;
  consumable: number;
}

// Supplier Financials "Platform Revenue" chart (Sprint 6.10) — revenue split
// by listing type for the caller's own company. `from`/`to` (2026-07-23,
// real date picker) take priority over `months` when given; refetches per
// range rather than slicing a fixed window client-side.
export function useSupplierRevenueByType(range: { from?: string | null; to?: string | null } = {}) {
  const { from, to } = range;
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (!from && !to) params.set("months", "12");
  const qs = params.toString();

  return useQuery({
    queryKey: ["supplier-revenue-by-type", from ?? null, to ?? null],
    queryFn: () => apiFetch<{ months: RevenueByTypeMonth[] }>(`/api/supplier/revenue/by-type?${qs}`),
    select: (data) => data.months,
  });
}
