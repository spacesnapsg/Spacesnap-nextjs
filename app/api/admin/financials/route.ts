import { NextRequest, NextResponse } from "next/server";
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
//
// feedSearch/feedPage (2026-07-27) only affect the transaction feed — the
// Admin Overview dashboard calls this with no params at all and only ever
// reads `summary`, so the feed's own search/pagination has to stay optional
// and not change that shape.
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const feedSearch = searchParams.get("feedSearch") ?? undefined;
  const feedPage = Math.max(1, Number(searchParams.get("feedPage")) || 1);

  const [summary, revenueByCompany, { transactions: transactionFeed, meta: transactionFeedMeta }] = await Promise.all([
    getPlatformRevenueSummary(),
    getRevenueByCompany(),
    getRevenueTransactionFeed({ search: feedSearch, page: feedPage }),
  ]);

  return NextResponse.json({ summary, revenueByCompany, transactionFeed, transactionFeedMeta });
}
