import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { purchaseBumps, InsufficientCompanyPurchasedBalanceError } from "@/lib/company-credits";

// Spending shared company funds — gated to requireCompanyAdmin, stricter
// than purchased_topup's "any member" gate, same reasoning as the Pin
// purchase route.
export async function POST(request: NextRequest) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const quantity = typeof b.quantity === "number" ? Math.floor(b.quantity) : NaN;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return validationErrorResponse(new ApiValidationError({ quantity: ["quantity must be a positive integer."] }));
  }

  try {
    const { bumpsAvailable } = await purchaseBumps(auth.companyId, quantity, auth.userId);
    return NextResponse.json({ bumpsAvailable });
  } catch (error) {
    if (error instanceof InsufficientCompanyPurchasedBalanceError) {
      return validationErrorResponse(new ApiValidationError({ quantity: [error.message] }));
    }
    throw error;
  }
}
