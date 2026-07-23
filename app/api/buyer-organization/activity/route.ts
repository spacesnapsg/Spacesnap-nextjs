import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { parseActivityQuery } from "@/lib/activity";
import { getBuyerOrgActivity, serializeBuyerOrgActivityEntry } from "@/lib/buyer-organizations";

// Org-admin-only, paginated (10/page) activity feed across every member of
// the org — split out of GET /api/buyer-organization/stats (2026-07-23) so
// paging/date-range state doesn't force a refetch of the cheap aggregate
// numbers. Same `?from=`/`?to=`/`?page=`/`?pageSize=` contract as
// GET /api/activity.
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

  const { items, total, page, pageSize } = await getBuyerOrgActivity(auth.buyerOrganizationId, query);

  return NextResponse.json({
    activity: items.map(serializeBuyerOrgActivityEntry),
    meta: { page, pageSize, total },
  });
}
