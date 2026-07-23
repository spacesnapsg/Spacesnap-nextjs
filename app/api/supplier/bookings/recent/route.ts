import { NextRequest, NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { parseActivityQuery } from "@/lib/activity";
import { getSupplierBookingsFeed, serializeBooking } from "@/lib/bookings";

// GET: paginated, date-range-filterable feed of the caller's own company's
// bookings — backs the Analytics page's "Recent Bookings" table. Separate
// from GET /api/supplier/bookings's own bulk (unpaginated) list, see
// getSupplierBookingsFeed's comment in lib/bookings.ts for why.
export async function GET(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  let query;
  try {
    query = parseActivityQuery(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const { items, total, page, pageSize } = await getSupplierBookingsFeed(auth.companyId, query);

  return NextResponse.json({
    bookings: items.map(serializeBooking),
    meta: { page, pageSize, total },
  });
}
