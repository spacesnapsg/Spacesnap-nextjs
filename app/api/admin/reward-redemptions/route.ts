import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { listPendingConciergeRedemptions } from "@/lib/reward-redemptions";

// System-admin-only. The pitch_ticket/consultancy "concierge" queue —
// redemptions still awaiting the admin arranging scheduling with the user's
// chosen partner (2026-07-22 fulfillment session). Surfaced as a new
// "Pending Concierge Requests" row on the Admin Overview page.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const redemptions = await listPendingConciergeRedemptions();

  return NextResponse.json({
    redemptions: redemptions.map((r) => ({
      id: r.id.toString(),
      itemName: r.itemName,
      itemCategory: r.itemCategory,
      selectedPartnerOption: r.selectedPartnerOption,
      redeemedAt: r.createdAt.toISOString(),
      user: { name: r.user.name, email: r.user.email },
    })),
  });
}
