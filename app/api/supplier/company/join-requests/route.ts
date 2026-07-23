import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { getPendingCompanyJoinRequests } from "@/lib/company-membership";

export async function GET() {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const requests = await getPendingCompanyJoinRequests(auth.companyId);
  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id.toString(),
      requestedBy: r.requestedBy,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
