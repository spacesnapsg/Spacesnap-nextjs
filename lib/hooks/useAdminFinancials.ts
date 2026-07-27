import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
  type: "topup" | "booking" | "refund" | "purchase" | "booking_payment" | "booking_modification_fee" | "purchased_spend";
  amount: string;
  companyId: string | null;
  companyName: string | null;
  description: string | null;
}

interface AdminFinancials {
  summary: PlatformRevenueSummary;
  revenueByCompany: CompanyRevenue[];
  transactionFeed: RevenueTransactionRow[];
  transactionFeedMeta: { page: number; perPage: number; total: number };
}

interface AdminFinancialsFilters {
  feedSearch?: string;
  feedPage?: number;
}

export function useAdminFinancials(filters: AdminFinancialsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.feedSearch) params.set("feedSearch", filters.feedSearch);
  if (filters.feedPage) params.set("feedPage", String(filters.feedPage));
  const qs = params.toString();

  return useQuery({
    queryKey: ["admin-financials", filters],
    queryFn: () => apiFetch<AdminFinancials>(`/api/admin/financials${qs ? `?${qs}` : ""}`),
    // Every feed search keystroke / page change is a new queryKey — without
    // this, `data` briefly goes undefined on each one, which flips the page's
    // top-level isLoading gate and unmounts the whole tree (losing the
    // Pricing & Commission card's own local search state in the process).
    placeholderData: keepPreviousData,
  });
}
