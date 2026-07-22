import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { listPendingSupplierConciergeRedemptions } from "@/lib/supplier-reward-redemptions";

// System-admin-only. The report/ad "concierge" queue — redemptions still
// awaiting the admin generating the report / arranging the ad placement.
// Company-scoped sibling of /api/admin/reward-redemptions.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const redemptions = await listPendingSupplierConciergeRedemptions();

  return NextResponse.json({
    redemptions: redemptions.map((r) => ({
      id: r.id.toString(),
      itemName: r.itemName,
      itemCategory: r.itemCategory,
      redeemedAt: r.createdAt.toISOString(),
      company: { name: r.company.name },
      redeemedByUser: { name: r.redeemedByUser.name, email: r.redeemedByUser.email },
    })),
  });
}
