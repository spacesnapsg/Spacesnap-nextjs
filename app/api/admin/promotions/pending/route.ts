import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { getPendingPromotions, serializePendingPromotion } from "@/lib/promotions";

export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const users = await getPendingPromotions();
  return NextResponse.json({ promotions: users.map(serializePendingPromotion) });
}
