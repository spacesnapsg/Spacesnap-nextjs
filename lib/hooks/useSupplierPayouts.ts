import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Mirrors the Prisma SupplierPayoutStatus enum (prisma/schema.prisma) as a
// plain string union, same convention as SupplierPayableStatus.
export type SupplierPayoutStatus = "billed" | "paid";

export interface SupplierPayoutEntry {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: SupplierPayoutStatus;
  xeroBillUrl: string | null;
  xeroRemittanceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

// Company-admin-only, full payout history for the caller's own company —
// backs the Financials page's "Accounts Receivable, Receipts & Invoices"
// card (closing the Sprint 6 Invoice/Receipt gap, 2026-07-24).
export function useSupplierPayouts() {
  return useQuery({
    queryKey: ["supplier-payouts"],
    queryFn: () => apiFetch<{ payouts: SupplierPayoutEntry[] }>("/api/supplier/company/payouts"),
    select: (data) => data.payouts,
  });
}
