import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, forbiddenResponse, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBooking,
  parseModifyBookingFields,
  modifyBookingWithFee,
  BookingNotModifiableError,
  BookingModificationNotEligibleError,
  BookingModificationOverlapError,
  ModificationPaymentMethodRequiredError,
  StripeChargeFailedError,
  BOOKING_OVERLAP_MESSAGE,
} from "@/lib/bookings";

// Sprint 4.75 — "Modify Booking." User-initiated reschedule, scoped to the
// booking's own owner (mirrors cancel/route.ts's ownership-check shape).
// See modifyBookingWithFee (lib/bookings.ts) for the notice-day eligibility/
// fee/refund-cap engine this wires up.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const bookingId = parseBigIntParam(id);
  if (bookingId === null) return notFoundResponse("Booking not found.");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return notFoundResponse("Booking not found.");
  if (booking.userId !== session.user.id) {
    return forbiddenResponse("You do not have access to this booking.");
  }

  const body = await request.json().catch(() => null);
  let fields;
  try {
    fields = parseModifyBookingFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    const updated = await modifyBookingWithFee({
      bookingId,
      newStartDate: fields.newStartDate,
      paymentMethodId: fields.paymentMethodId,
    });
    return NextResponse.json({ booking: serializeBooking(updated) });
  } catch (error) {
    if (error instanceof BookingNotModifiableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof BookingModificationNotEligibleError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof ModificationPaymentMethodRequiredError) {
      return validationErrorResponse(new ApiValidationError({ paymentMethodId: [error.message] }));
    }
    if (error instanceof BookingModificationOverlapError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof StripeChargeFailedError) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }
    // Race window between modifyBookingWithFee's own overlap pre-check and
    // the actual update: the bookings_no_overlap exclusion constraint is the
    // real source of truth and still fires here if another request's
    // booking landed in between — same 23P01 translation the create-booking
    // route uses. modifyBookingWithFee has already refunded any modification
    // fee charge by the time this error surfaces (see its own catch block).
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "23P01") {
      return NextResponse.json({ message: BOOKING_OVERLAP_MESSAGE }, { status: 409 });
    }
    throw error;
  }
}
