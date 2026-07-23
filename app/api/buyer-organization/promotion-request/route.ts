import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import {
  requestBuyerOrgPromotion,
  AlreadyBuyerOrgAdminError,
  BuyerOrgPromotionAlreadyRequestedError,
  BuyerOrgAlreadyHasAdminError,
} from "@/lib/buyer-organizations";

// Mirrors app/api/promotion-request/route.ts — only ever reaches the
// system-admin queue when the org has no admin at all yet
// (BuyerOrgAlreadyHasAdminError otherwise; the org's own admin promotes
// members directly via POST /api/buyer-organization/members/[id]/promote).
export async function POST() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  try {
    await requestBuyerOrgPromotion(session.user.id);
    return NextResponse.json({ promotionRequested: true });
  } catch (error) {
    if (
      error instanceof AlreadyBuyerOrgAdminError ||
      error instanceof BuyerOrgPromotionAlreadyRequestedError ||
      error instanceof BuyerOrgAlreadyHasAdminError
    ) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
