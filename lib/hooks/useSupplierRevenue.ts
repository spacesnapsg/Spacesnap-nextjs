import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface MonthlyRevenue {
  month: string;
  revenue: string;
}

export function useSupplierRevenue() {
  return useQuery({
    queryKey: ["supplier-revenue"],
    queryFn: () => apiFetch<{ months: MonthlyRevenue[] }>("/api/supplier/revenue"),
    select: (data) => data.months,
  });
}
