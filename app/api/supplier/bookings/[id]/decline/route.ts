import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBooking,
  declineBookingWithRefund,
  BookingNotDeclinableError,
  StripeRefundFailedError,
} from "@/lib/bookings";

// Mirrors old SupplierBookingController::decline's status-guard and
// company-ownership check, plus Sprint 3.5 known-gap #3: decline now issues a
// real Stripe refund (sized by the cancellation-window policy) via
// declineBookingWithRefund (see lib/bookings.ts), rather than the old flat
// combined-ledger credit.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const bookingId = parseBigIntParam(id);
  if (bookingId === null) return notFoundResponse("Booking not found.");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: true } });
  if (!booking) return notFoundResponse("Booking not found.");
  if (booking.listing.companyId !== auth.companyId) {
    return forbiddenResponse("You do not have access to this booking.");
  }

  const body = await request.json().catch(() => null);
  const reason =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).reason === "string"
      ? ((body as Record<string, unknown>).reason as string)
      : undefined;

  try {
    const updated = await declineBookingWithRefund(bookingId, reason);
    return NextResponse.json({ booking: serializeBooking(updated) });
  } catch (error) {
    if (error instanceof BookingNotDeclinableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof StripeRefundFailedError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    throw error;
  }
}
