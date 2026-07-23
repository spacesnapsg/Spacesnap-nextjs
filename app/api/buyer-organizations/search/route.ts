import { NextRequest, NextResponse } from "next/server";
import { searchBuyerOrganizationsByName } from "@/lib/buyer-organizations";

// Public — same "safe to expose org/company names for signup autocomplete"
// posture as GET /api/companies/search. No auth required, no PII beyond a
// name a user already typed to search for.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const organizations = await searchBuyerOrganizationsByName(q);
  return NextResponse.json({ organizations });
}
