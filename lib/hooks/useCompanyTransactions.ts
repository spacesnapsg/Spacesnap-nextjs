import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Mirrors the Prisma CompanyTransactionType enum (prisma/schema.prisma) as a
// plain string union — frontend code doesn't import the generated Prisma
// client, same convention as BookingStatus (lib/hooks/useSupplierBookings.ts)
// and ActivityActionType (lib/hooks/useActivity.ts).
export type CompanyTransactionType = "purchased_topup" | "earned_rebate" | "earned_spend";

export interface CompanyTransactionEntry {
  id: string;
  type: CompanyTransactionType;
  amount: number;
  description: string;
  userName: string | null;
  createdAt: string;
}

export interface CompanyTransactionsPageResult {
  transactions: CompanyTransactionEntry[];
  meta: { page: number; pageSize: number; total: number };
}

// Company-admin-only, paginated + date-range-filterable feed of the shared
// CompanyTransaction ledger — backs the Financials page's "Credit Movement"
// card (Sprint 6.10 "Supplier Analytics/Financials Reshuffle", 2026-07-23).
// Mirrors useActivity/useSupplierBookingsFeed's query-building shape.
export function useCompanyTransactions(dateRange: { from: string | null; to: string | null }, page: number) {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  params.set("page", String(page));

  return useQuery({
    queryKey: ["company-transactions", dateRange, page],
    queryFn: () => apiFetch<CompanyTransactionsPageResult>(`/api/supplier/company/transactions?${params.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}
