import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { parseActivityQuery } from "@/lib/activity";
import { getCompanyTransactionsPage, serializeCompanyTransaction } from "@/lib/company-credits";

// GET: paginated, date-range-filterable feed of the caller's own company's
// shared credit ledger (CompanyTransaction) — backs the Financials page's
// "Credit Movement" card. Company-admin-only, unlike the topup route (any
// member can top up, but reading the full ledger is an admin-level view,
// matching requireCompanyAdmin's existing use on the business-details edit
// route).
export async function GET(request: NextRequest) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  let query;
  try {
    query = parseActivityQuery(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const { items, total, page, pageSize } = await getCompanyTransactionsPage(auth.companyId, query);

  return NextResponse.json({
    transactions: items.map(serializeCompanyTransaction),
    meta: { page, pageSize, total },
  });
}
