import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { getPendingBuyerOrgPromotions, serializePendingBuyerOrgPromotion } from "@/lib/buyer-organizations";

export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const users = await getPendingBuyerOrgPromotions();
  return NextResponse.json({ promotions: users.map(serializePendingBuyerOrgPromotion) });
}
