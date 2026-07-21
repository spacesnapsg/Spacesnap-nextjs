import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  resolveBookingCreditWithRefund,
  BookingCreditNotResolvableError,
  StripeRefundFailedError,
  serializeBooking,
} from "@/lib/bookings";

// The last card in the rebook-alternatives scroll — "none of these work,
// refund me instead." Scoped to the booking's own user, mirroring the
// cancel/decline routes' ownership-check pattern. Resolves the booking's
// available BookingCredit via a real Stripe refund immediately, rather than
// waiting out the 7-day forced-resolution window.
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

  const credit = await prisma.bookingCredit.findFirst({ where: { sourceBookingId: bookingId, status: "available" } });
  if (!credit) {
    return NextResponse.json({ message: "This booking has no outstanding credit to refund." }, { status: 422 });
  }

  try {
    await resolveBookingCreditWithRefund(credit.id, "user_claim");
  } catch (error) {
    if (error instanceof BookingCreditNotResolvableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof StripeRefundFailedError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    throw error;
  }

  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  return NextResponse.json({ booking: serializeBooking(updated) });
}
