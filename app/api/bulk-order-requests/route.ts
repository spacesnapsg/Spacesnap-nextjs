import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { InsufficientCreditBalanceError } from "@/lib/credits";
import { createBulkOrderWithDebit, parseBulkOrderCreateFields, serializeBulkOrderRequest } from "@/lib/bulk-orders";

// POST: create a bulk order request. Mirrors old BulkOrderRequestController::store's
// shape (consumables-only, quantity min:1), plus Sprint 3.5 known-gap #4: the
// credit_balance check, BulkOrderRequest insert, and debit Transaction row all
// happen inside a single DB transaction via createBulkOrderWithDebit
// (lib/bulk-orders.ts) — the same pattern createBookingWithDebit already uses.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseBulkOrderCreateFields(body);
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
      new ApiValidationError({
        listingId: ["Bulk order requests are only available for consumable listings."],
      })
    );
  }

  if (listing.pricePerUnit === null) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["This listing has no per-unit price set."] }));
  }

  const cost = listing.pricePerUnit.mul(fields.quantity);

  try {
    const bulkOrderRequest = await createBulkOrderWithDebit({
      userId: session.user.id,
      listingId: fields.listingId,
      quantity: fields.quantity,
      cost,
    });

    return NextResponse.json({ bulkOrderRequest: serializeBulkOrderRequest(bulkOrderRequest) }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientCreditBalanceError) {
      return validationErrorResponse(new ApiValidationError({ credits: [error.message] }));
    }
    throw error;
  }
}
