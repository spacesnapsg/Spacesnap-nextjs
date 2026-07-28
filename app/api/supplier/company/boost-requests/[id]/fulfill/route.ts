import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import {
  fulfillCompanyBoostRequest,
  serializeCompanyBoostRequest,
  getCompanyBoostRequestById,
  CompanyBoostRequestNotFoundError,
  CompanyBoostRequestNotPendingError,
  InsufficientCompanyPurchasedBalanceError,
  ListingNotFoundError,
  ListingNotAvailableError,
} from "@/lib/company-boost-requests";
import { NotCompanyAdminError } from "@/lib/company-membership";

// POST: the company admin approves a pending request — actually calls the
// same purchaseBumps/purchaseAndApplyPin the direct-purchase routes call,
// funded by the shared company balance. See
// lib/company-boost-requests.ts's fulfillCompanyBoostRequest for the full
// rationale.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireCompanyAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "Invalid request id." }, { status: 422 });
  }

  try {
    const request = await fulfillCompanyBoostRequest(authResult.userId, BigInt(id));
    const full = await getCompanyBoostRequestById(request.id);
    return NextResponse.json({ request: serializeCompanyBoostRequest(full!) });
  } catch (error) {
    if (error instanceof CompanyBoostRequestNotFoundError) return notFoundResponse(error.message);
    if (error instanceof CompanyBoostRequestNotPendingError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotCompanyAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof InsufficientCompanyPurchasedBalanceError) {
      return validationErrorResponse(new ApiValidationError({ quantity: [error.message] }));
    }
    if (error instanceof ListingNotFoundError) return notFoundResponse(error.message);
    if (error instanceof ListingNotAvailableError) {
      return validationErrorResponse(new ApiValidationError({ listingId: [error.message] }));
    }
    throw error;
  }
}
