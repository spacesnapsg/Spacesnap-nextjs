import { NextRequest, NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { getCompanyNetPayoutByTypeAndMonth } from "@/lib/revenue";

// Supplier Financials "My Earnings" chart — the caller's own company, NET
// PAYOUT split by listing type per month (F2/F5, 2026-07-25: shows what the
// supplier is actually paid, not the marked-up member price). `months` clamps
// to the three original
// preset ranges (3/6/12); anything else falls back to 12. `from`/`to`
// (2026-07-23, real date picker) override `months` entirely when given —
// same "explicit ISO date, validated, else 400" idiom as parseActivityQuery
// (lib/activity.ts).
const ALLOWED_MONTHS = new Set([3, 6, 12]);

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
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const errors: Record<string, string[]> = {};
  const from = parseDateParam(request.nextUrl.searchParams.get("from"), "from", errors);
  const to = parseDateParam(request.nextUrl.searchParams.get("to"), "to", errors);
  if (Object.keys(errors).length > 0) return validationErrorResponse(new ApiValidationError(errors));

  const rawMonths = Number(request.nextUrl.searchParams.get("months"));
  const months = ALLOWED_MONTHS.has(rawMonths) ? rawMonths : 12;

  const data = await getCompanyNetPayoutByTypeAndMonth(auth.companyId, { months, from, to });
  return NextResponse.json({ months: data });
}
