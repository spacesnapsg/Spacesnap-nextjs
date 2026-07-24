import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { listPendingMarketplaceEnquiries } from "@/lib/marketplace-enquiries";

// System-admin-only. The membership/consultancy enquiry queue, surfaced as
// the "Pending Enquiries from Marketplace" row on the Admin Overview page.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const enquiries = await listPendingMarketplaceEnquiries();

  return NextResponse.json({
    enquiries: enquiries.map((e) => ({
      id: e.id.toString(),
      type: e.type,
      details: e.details,
      contactEmail: e.contactEmail,
      createdAt: e.createdAt.toISOString(),
      requestedBy: {
        name: e.requestedBy.name,
        email: e.requestedBy.email,
        companyName: e.requestedBy.company?.name ?? null,
      },
    })),
  });
}
