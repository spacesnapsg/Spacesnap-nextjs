import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { setMemberBoostPermission, NotCompanyAdminError, NotInSameCompanyError } from "@/lib/company-membership";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";

// PATCH: the company admin grants/revokes a member's delegated Boost-catalogue
// spend rights — body { canPurchaseBoosts: boolean }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireCompanyAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }
  const { canPurchaseBoosts } = body as Record<string, unknown>;
  if (typeof canPurchaseBoosts !== "boolean") {
    return validationErrorResponse(new ApiValidationError({ canPurchaseBoosts: ["canPurchaseBoosts must be a boolean."] }));
  }

  try {
    await setMemberBoostPermission(authResult.userId, id, canPurchaseBoosts);
    return NextResponse.json({ id, canPurchaseBoosts });
  } catch (error) {
    if (error instanceof NotInSameCompanyError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotCompanyAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
