import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBooking,
  cancelBookingWithRefund,
  BookingNotCancellableError,
  StripeRefundFailedError,
} from "@/lib/bookings";

// User-initiated cancellation, mirroring the supplier decline route's shape
// (app/api/supplier/bookings/[id]/decline/route.ts) but scoped to the
// booking's own owner instead of the listing's company. See
// cancelBookingWithRefund (lib/bookings.ts) for the refund/penalty math —
// the user's own booking-owner check happens here, same pattern as decline's
// company-ownership check happening in its route rather than the lib layer.
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
  const reason =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).reason === "string"
      ? ((body as Record<string, unknown>).reason as string)
      : undefined;

  try {
    const updated = await cancelBookingWithRefund(bookingId, reason);
    return NextResponse.json({ booking: serializeBooking(updated) });
  } catch (error) {
    if (error instanceof BookingNotCancellableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof StripeRefundFailedError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    throw error;
  }
}
