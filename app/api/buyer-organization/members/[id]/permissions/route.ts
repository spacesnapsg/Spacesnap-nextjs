import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import {
  setMemberBookingPermission,
  setMemberPurchasePermission,
  NotBuyerOrgAdminError,
  NotInSameOrgError,
} from "@/lib/buyer-organizations";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";

// PATCH: the org admin grants/revokes a member's own delegated pool-spend
// rights — body { canBook?: boolean, canPurchase?: boolean }, either or both.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }
  const { canBook, canPurchase } = body as Record<string, unknown>;
  if (canBook === undefined && canPurchase === undefined) {
    return validationErrorResponse(new ApiValidationError({ canBook: ["At least one of canBook, canPurchase is required."] }));
  }
  if (canBook !== undefined && typeof canBook !== "boolean") {
    return validationErrorResponse(new ApiValidationError({ canBook: ["canBook must be a boolean."] }));
  }
  if (canPurchase !== undefined && typeof canPurchase !== "boolean") {
    return validationErrorResponse(new ApiValidationError({ canPurchase: ["canPurchase must be a boolean."] }));
  }

  try {
    if (canBook !== undefined) {
      await setMemberBookingPermission(authResult.userId, id, canBook);
    }
    if (canPurchase !== undefined) {
      await setMemberPurchasePermission(authResult.userId, id, canPurchase);
    }
    return NextResponse.json({ id, canBook, canPurchase });
  } catch (error) {
    if (error instanceof NotInSameOrgError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotBuyerOrgAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
