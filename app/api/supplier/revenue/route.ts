import { NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { getCompanyRevenueByMonth } from "@/lib/revenue";

// Supplier Dashboard "Revenue Over Time" chart — scoped to the caller's own
// company, last 6 months. Same underlying aggregation as the admin financials
// endpoint (lib/revenue.ts), scoped by companyId instead of platform-wide.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const months = await getCompanyRevenueByMonth(auth.companyId);
  return NextResponse.json({ months });
}
