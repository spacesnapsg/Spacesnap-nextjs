import { NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { getPendingBuyerOrgJoinRequests } from "@/lib/buyer-organizations";

export async function GET() {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const requests = await getPendingBuyerOrgJoinRequests(authResult.buyerOrganizationId);
  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id.toString(),
      requestedBy: r.requestedBy,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
