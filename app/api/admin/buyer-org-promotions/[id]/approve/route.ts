import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse } from "@/lib/api-errors";
import { approveBuyerOrgPromotion, BuyerOrgPromotionNotPendingError } from "@/lib/buyer-organizations";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const user = await approveBuyerOrgPromotion(id);
    if (!user) return notFoundResponse("User not found.");

    return NextResponse.json({
      id: user.id,
      isBuyerOrgAdmin: user.isBuyerOrgAdmin,
      buyerOrganizationName: user.buyerOrganization?.name ?? null,
    });
  } catch (error) {
    if (error instanceof BuyerOrgPromotionNotPendingError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
