import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface RevenueByTypeMonth {
  month: string; // "YYYY-MM"
  space: number;
  equipment: number;
  consumable: number;
}

// Supplier Financials "Platform Revenue" chart (Sprint 6.10) — revenue split
// by listing type for the caller's own company. `months` is one of 3/6/12
// (the UI's range toggle); refetches per range rather than slicing a fixed
// window client-side.
export function useSupplierRevenueByType(months: 3 | 6 | 12) {
  return useQuery({
    queryKey: ["supplier-revenue-by-type", months],
    queryFn: () => apiFetch<{ months: RevenueByTypeMonth[] }>(`/api/supplier/revenue/by-type?months=${months}`),
    select: (data) => data.months,
  });
}
