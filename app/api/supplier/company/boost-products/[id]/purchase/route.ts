import { NextRequest, NextResponse } from "next/server";
import { requireCompanyBoostPurchasePermission } from "@/lib/supplier-auth";
import { validationErrorResponse, notFoundResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { InsufficientCompanyPurchasedBalanceError } from "@/lib/company-credits";
import {
  purchaseBoostProduct,
  parsePurchaseQuantity,
  BoostProductNotFoundError,
  BoostProductInactiveError,
  BoostProductNotPurchasableHereError,
} from "@/lib/boost-products";

// Direct purchase of a builtinEffect "none" catalogue product — Bumps/Pin
// keep their own dedicated routes (bumps/purchase, pins/purchase). Same
// permission gate as those: admin OR a member with delegated
// companyCanPurchaseBoosts. A non-permitted member is routed to POST
// /api/supplier/company/boost-requests instead (frontend concern).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompanyBoostPurchasePermission();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const productId = parseBigIntParam(id);
  if (productId === null) return notFoundResponse("Boost product not found.");

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  try {
    const quantity = parsePurchaseQuantity(b.quantity);
    const { product, quantity: purchasedQuantity } = await purchaseBoostProduct(auth.companyId, productId, quantity, auth.userId);
    return NextResponse.json({ boostProductId: product.id.toString(), quantity: purchasedQuantity });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof BoostProductNotFoundError) return notFoundResponse(error.message);
    if (error instanceof BoostProductNotPurchasableHereError) {
      return validationErrorResponse(new ApiValidationError({ id: [error.message] }));
    }
    if (error instanceof BoostProductInactiveError || error instanceof InsufficientCompanyPurchasedBalanceError) {
      return validationErrorResponse(new ApiValidationError({ quantity: [error.message] }));
    }
    throw error;
  }
}
