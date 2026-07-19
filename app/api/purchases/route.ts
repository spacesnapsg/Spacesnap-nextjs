import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { InsufficientCreditBalanceError } from "@/lib/credits";
import { createPurchaseWithDebit, parsePurchaseCreateFields, serializePurchase, InsufficientStockError } from "@/lib/purchases";

// POST: "Buy Now" — an immediate, completed purchase (consumables only),
// distinct from POST /api/bulk-order-requests (a pending request the
// supplier still has to act on). Stock and credits move atomically inside
// createPurchaseWithDebit (lib/purchases.ts).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parsePurchaseCreateFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const listing = await prisma.listing.findUnique({ where: { id: fields.listingId } });
  if (!listing) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["listingId does not exist."] }));
  }

  if (listing.type !== "consumables") {
    return validationErrorResponse(
      new ApiValidationError({ listingId: ["Buy Now is only available for consumable listings."] })
    );
  }

  if (listing.pricePerUnit === null) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["This listing has no per-unit price set."] }));
  }

  const cost = listing.pricePerUnit.mul(fields.quantity);

  try {
    const purchase = await createPurchaseWithDebit({
      userId: session.user.id,
      listingId: fields.listingId,
      quantity: fields.quantity,
      cost,
    });

    return NextResponse.json({ purchase: serializePurchase(purchase) }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientCreditBalanceError) {
      return validationErrorResponse(new ApiValidationError({ credits: [error.message] }));
    }
    if (error instanceof InsufficientStockError) {
      return validationErrorResponse(new ApiValidationError({ quantity: [error.message] }));
    }
    throw error;
  }
}
