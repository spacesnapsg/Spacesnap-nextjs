import { NextRequest, NextResponse } from "next/server";
import { searchCompaniesByName } from "@/lib/company-membership";

// Public — powers the signup page's company search-or-create field. Company
// names are already visible platform-wide (marketplace listings), so no new
// exposure here.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const companies = await searchCompaniesByName(q);
  return NextResponse.json({ companies });
}
