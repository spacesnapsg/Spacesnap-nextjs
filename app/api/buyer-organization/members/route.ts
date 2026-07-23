import { NextResponse } from "next/server";
import { requireBuyerOrgMember } from "@/lib/buyer-org-auth";
import { getBuyerOrgMembers } from "@/lib/buyer-organizations";

export async function GET() {
  const auth = await requireBuyerOrgMember();
  if ("error" in auth) return auth.error;

  const members = await getBuyerOrgMembers(auth.buyerOrganizationId);
  return NextResponse.json({ members });
}
