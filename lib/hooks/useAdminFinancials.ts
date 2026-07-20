import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface PlatformRevenueSummary {
  totalCompanies: number;
  totalBookings: number;
  totalRevenue: string;
}

export interface CompanyRevenue {
  companyId: string;
  companyName: string;
  revenue: string;
}

export interface RevenueTransactionRow {
  id: string;
  createdAt: string;
  type: "topup" | "booking" | "refund" | "purchase";
  amount: string;
  companyId: string | null;
  companyName: string | null;
  description: string | null;
}

interface AdminFinancials {
  summary: PlatformRevenueSummary;
  revenueByCompany: CompanyRevenue[];
  transactionFeed: RevenueTransactionRow[];
}

export function useAdminFinancials() {
  return useQuery({
    queryKey: ["admin-financials"],
    queryFn: () => apiFetch<AdminFinancials>("/api/admin/financials"),
  });
}
