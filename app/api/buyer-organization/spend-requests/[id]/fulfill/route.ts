import { NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { InsufficientCreditBalanceError } from "@/lib/credits";
import { InsufficientStockError } from "@/lib/purchases";
import {
  StripeChargeFailedError,
  StripeRefundFailedError,
  BOOKING_OVERLAP_MESSAGE,
} from "@/lib/bookings";
import { ListingNotFoundError } from "@/lib/listings";
import {
  fulfillBuyerOrgSpendRequest,
  serializeBuyerOrgSpendRequest,
  getBuyerOrgSpendRequestById,
  BuyerOrgSpendRequestNotFoundError,
  BuyerOrgSpendRequestNotPendingError,
  BuyerOrgSpendRequestMissingCertificatesError,
  BuyerOrgSpendRequestOverlapError,
} from "@/lib/buyer-org-spend-requests";
import { NotBuyerOrgAdminError } from "@/lib/buyer-organizations";
import { serializeBooking } from "@/lib/bookings";
import { serializePurchase } from "@/lib/purchases";

// POST: the org admin approves a pending request — actually creates the
// booking/purchase, funded by the pool, under the requesting member's own
// account. See lib/buyer-org-spend-requests.ts's fulfillBuyerOrgSpendRequest
// for the full "mirrors the direct booking/purchase routes' own checks"
// rationale.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "Invalid request id." }, { status: 422 });
  }

  try {
    const { request, booking, purchase } = await fulfillBuyerOrgSpendRequest(authResult.userId, BigInt(id));
    const full = await getBuyerOrgSpendRequestById(request.id);
    return NextResponse.json({
      request: serializeBuyerOrgSpendRequest(full!),
      booking: booking ? serializeBooking(booking) : null,
      purchase: purchase ? serializePurchase(purchase) : null,
    });
  } catch (error) {
    if (error instanceof BuyerOrgSpendRequestNotFoundError) return notFoundResponse(error.message);
    if (error instanceof BuyerOrgSpendRequestNotPendingError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof NotBuyerOrgAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof BuyerOrgSpendRequestMissingCertificatesError) {
      return NextResponse.json(
        { message: error.message, missingCertificates: error.certificateNames },
        { status: 422 }
      );
    }
    if (error instanceof BuyerOrgSpendRequestOverlapError) {
      return NextResponse.json({ message: BOOKING_OVERLAP_MESSAGE }, { status: 409 });
    }
    if (error instanceof InsufficientCreditBalanceError) {
      return validationErrorResponse(new ApiValidationError({ fundingSource: ["Your organization's pool doesn't have enough credits for this."] }));
    }
    if (error instanceof InsufficientStockError) {
      return validationErrorResponse(new ApiValidationError({ quantity: [error.message] }));
    }
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof ListingNotFoundError) return notFoundResponse(error.message);
    if (error instanceof StripeChargeFailedError) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }
    if (error instanceof StripeRefundFailedError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    throw error;
  }
}
