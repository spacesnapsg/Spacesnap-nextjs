import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { serializeBooking, declineBookingWithRefund, BookingNotDeclinableError } from "@/lib/bookings";

// Mirrors old SupplierBookingController::decline's status-guard and
// company-ownership check, plus Sprint 3.5 known-gap #3: decline now creates
// its own refund Transaction via declineBookingWithRefund (see
// lib/bookings.ts) — restoring the credits debited at booking creation,
// which the old build did here too but this port had left stubbed out.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const updated = await declineBookingWithRefund(bookingId);
    return NextResponse.json({ booking: serializeBooking(updated) });
  } catch (error) {
    if (error instanceof BookingNotDeclinableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
