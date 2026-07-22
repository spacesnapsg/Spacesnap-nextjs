import { NextRequest, NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { getCompanyRevenueByTypeAndMonth } from "@/lib/revenue";

// Supplier Financials "Platform Revenue" chart — the caller's own company,
// revenue split by listing type per month (Sprint 6.10, replaces the page's
// buildPlaceholderRevenueByType). `months` clamps to the three ranges the UI
// offers (3/6/12); anything else falls back to 12.
const ALLOWED_MONTHS = new Set([3, 6, 12]);

export async function GET(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const raw = Number(request.nextUrl.searchParams.get("months"));
  const months = ALLOWED_MONTHS.has(raw) ? raw : 12;

  const data = await getCompanyRevenueByTypeAndMonth(auth.companyId, months);
  return NextResponse.json({ months: data });
}
