import { NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import {
  AlreadyCompanyAdminError,
  PromotionAlreadyRequestedError,
  CompanyAlreadyHasAdminError,
  requestPromotion,
} from "@/lib/promotions";

// POST: the caller (a supplier) requests promotion to company admin within
// their own company. Sets promotionRequested on the caller's own row. Only
// reaches the system-admin queue when the company has no admin at all yet
// (CompanyAlreadyHasAdminError otherwise, 2026-07-23 amendment) — the
// company's own admin promotes members directly via
// POST /api/supplier/company/members/[id]/promote.
export async function POST() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  try {
    await requestPromotion(auth.userId);
    return NextResponse.json({ promotionRequested: true });
  } catch (error) {
    if (
      error instanceof AlreadyCompanyAdminError ||
      error instanceof PromotionAlreadyRequestedError ||
      error instanceof CompanyAlreadyHasAdminError
    ) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
