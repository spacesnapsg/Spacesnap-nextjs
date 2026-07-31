import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { parseActivityQuery } from "@/lib/activity";
import {
  getBuyerOrgTransactions,
  serializeBuyerOrgTransaction,
  type BuyerOrgTransactionScope,
} from "@/lib/buyer-organizations";

const VALID_SCOPES = new Set<string>(["all", "personal", "others"]);

// Org-admin-only, paginated (10/page) credit-movement feed across every
// member of the org — split out of GET /api/buyer-organization/stats
// (2026-07-23), same reasoning as GET /api/buyer-organization/activity.
// Reuses parseActivityQuery (its `types` field is simply unused here) for
// the same `?from=`/`?to=`/`?page=`/`?pageSize=` contract as every other
// paginated audit-trail feed in this codebase. `?scope=` (all/personal/others)
// added later to give the admin a Personal-vs-Others filter over the shared
// pool's mixed feed.
export async function GET(request: NextRequest) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const searchParams = new URL(request.url).searchParams;

  let query;
  try {
    query = parseActivityQuery(searchParams);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const rawScope = searchParams.get("scope");
  if (rawScope && !VALID_SCOPES.has(rawScope)) {
    return validationErrorResponse(new ApiValidationError({ scope: ["Must be one of all, personal, others."] }));
  }
  const scope = (rawScope ?? "all") as BuyerOrgTransactionScope;

  const { items, total, page, pageSize } = await getBuyerOrgTransactions(
    auth.buyerOrganizationId,
    query,
    scope,
    auth.userId
  );

  return NextResponse.json({
    transactions: items.map(serializeBuyerOrgTransaction),
    meta: { page, pageSize, total },
  });
}
