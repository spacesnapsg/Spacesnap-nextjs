import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import {
  getPlatformRevenueSummary,
  getRevenueByCompany,
  getRevenueTransactionFeed,
} from "@/lib/revenue";

// Backs both the Admin Overview stat cards (summary only) and the Admin
// Financials page (revenue-by-operator + cross-company transaction feed) —
// closes the "no admin-wide aggregation endpoint" gap tracked since Sprint 3
// Session 4 (transactions are keyed by user, not company, so this needed its
// own aggregation rather than a small join).
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const [summary, revenueByCompany, transactionFeed] = await Promise.all([
    getPlatformRevenueSummary(),
    getRevenueByCompany(),
    getRevenueTransactionFeed(),
  ]);

  return NextResponse.json({ summary, revenueByCompany, transactionFeed });
}
