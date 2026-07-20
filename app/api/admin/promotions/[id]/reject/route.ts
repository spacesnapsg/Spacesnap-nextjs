import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse } from "@/lib/api-errors";
import { rejectPromotion, PromotionNotPendingError } from "@/lib/promotions";
import { serializeAdminUser } from "@/lib/admin-users";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const user = await rejectPromotion(id);
    if (!user) return notFoundResponse("User not found.");

    return NextResponse.json({ user: serializeAdminUser(user) });
  } catch (error) {
    if (error instanceof PromotionNotPendingError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
