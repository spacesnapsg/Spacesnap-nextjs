import { NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { getBuyerOrgStats, serializeBuyerOrgStats } from "@/lib/buyer-organizations";

// Org-admin-only overview: total/upcoming bookings, recent activity, and
// recent credit movement, aggregated across every member of the org. Backs
// the "Manage Organization" modal's new Overview tab.
export async function GET() {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const stats = await getBuyerOrgStats(auth.buyerOrganizationId);
  return NextResponse.json(serializeBuyerOrgStats(stats));
}
