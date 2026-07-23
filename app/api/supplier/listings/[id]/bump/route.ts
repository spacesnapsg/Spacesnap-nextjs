import { NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam, activateBump, ListingNotFoundError, NoBumpsAvailableError } from "@/lib/listings";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const listingId = parseBigIntParam(id);
  if (listingId === null) return notFoundResponse("Listing not found.");

  try {
    const listing = await activateBump(listingId, auth.companyId);
    return NextResponse.json({ boostedAt: listing.boostedAt.toISOString() });
  } catch (error) {
    if (error instanceof ListingNotFoundError) return notFoundResponse(error.message);
    if (error instanceof NoBumpsAvailableError) {
      return validationErrorResponse(new ApiValidationError({ bumps: [error.message] }));
    }
    throw error;
  }
}
