import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { validationErrorResponse, ApiValidationError, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam, serializeListing, purchaseAndApplyPin, ListingNotFoundError, ListingNotAvailableError } from "@/lib/listings";
import { InsufficientCompanyPurchasedBalanceError } from "@/lib/company-credits";

// Spending shared company funds — gated to requireCompanyAdmin, same
// reasoning as the Bumps purchase route. Purchase and application are one
// combined action (see purchaseAndApplyPin's own comment).
export async function POST(request: NextRequest) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const listingId = typeof b.listingId === "string" ? parseBigIntParam(b.listingId) : null;
  if (listingId === null) return notFoundResponse("Listing not found.");

  const durationDays = b.durationDays === 7 || b.durationDays === 30 ? b.durationDays : null;
  if (durationDays === null) {
    return validationErrorResponse(new ApiValidationError({ durationDays: ["durationDays must be 7 or 30."] }));
  }

  try {
    const listing = await purchaseAndApplyPin(auth.companyId, listingId, durationDays, auth.userId);
    return NextResponse.json({ listing: serializeListing(listing) });
  } catch (error) {
    if (error instanceof ListingNotFoundError) return notFoundResponse(error.message);
    if (error instanceof ListingNotAvailableError) {
      return validationErrorResponse(new ApiValidationError({ listingId: [error.message] }));
    }
    if (error instanceof InsufficientCompanyPurchasedBalanceError) {
      return validationErrorResponse(new ApiValidationError({ durationDays: [error.message] }));
    }
    throw error;
  }
}
