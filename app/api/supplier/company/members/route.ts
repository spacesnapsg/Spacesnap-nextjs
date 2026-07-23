import { NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { getCompanyMembers } from "@/lib/company-membership";

export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const members = await getCompanyMembers(auth.companyId);
  return NextResponse.json({ members });
}
