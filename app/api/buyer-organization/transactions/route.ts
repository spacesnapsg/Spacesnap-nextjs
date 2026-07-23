import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { parseActivityQuery } from "@/lib/activity";
import { getBuyerOrgTransactions, serializeBuyerOrgTransaction } from "@/lib/buyer-organizations";

// Org-admin-only, paginated (10/page) credit-movement feed across every
// member of the org — split out of GET /api/buyer-organization/stats
// (2026-07-23), same reasoning as GET /api/buyer-organization/activity.
// Reuses parseActivityQuery (its `types` field is simply unused here) for
// the same `?from=`/`?to=`/`?page=`/`?pageSize=` contract as every other
// paginated audit-trail feed in this codebase.
export async function GET(request: NextRequest) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  let query;
  try {
    query = parseActivityQuery(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const { items, total, page, pageSize } = await getBuyerOrgTransactions(auth.buyerOrganizationId, query);

  return NextResponse.json({
    transactions: items.map(serializeBuyerOrgTransaction),
    meta: { page, pageSize, total },
  });
}
