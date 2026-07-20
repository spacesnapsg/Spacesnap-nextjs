import { NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { AlreadyCompanyAdminError, PromotionAlreadyRequestedError, requestPromotion } from "@/lib/promotions";

// POST: the caller (a supplier) requests promotion to company admin within
// their own company. Sets promotionRequested on the caller's own row.
export async function POST() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  try {
    await requestPromotion(auth.userId);
    return NextResponse.json({ promotionRequested: true });
  } catch (error) {
    if (error instanceof AlreadyCompanyAdminError || error instanceof PromotionAlreadyRequestedError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
