import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { getCompanyNetPayoutByOwner } from "@/lib/revenue";

// Supplier Financials "My Earnings" card's admin-only "By Supplier" toggle —
// each staff member's own net payout within the caller's company, for a date
// range. Admin-gated (requireCompanyAdmin, not requireSupplier) — a regular
// staff member never sees a teammate's individual earnings, only the
// company-wide "By Listing Type" total everyone gets via GET .../by-type.
// No `months` preset (unlike by-type) since this isn't month-bucketed.
function parseDateParam(raw: string | null, field: string, errors: Record<string, string[]>): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors[field] = [`${field} must be a valid date.`];
    return undefined;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const errors: Record<string, string[]> = {};
  const from = parseDateParam(request.nextUrl.searchParams.get("from"), "from", errors);
  const to = parseDateParam(request.nextUrl.searchParams.get("to"), "to", errors);
  if (Object.keys(errors).length > 0) return validationErrorResponse(new ApiValidationError(errors));

  const members = await getCompanyNetPayoutByOwner(auth.companyId, { from, to });
  return NextResponse.json({ members });
}
