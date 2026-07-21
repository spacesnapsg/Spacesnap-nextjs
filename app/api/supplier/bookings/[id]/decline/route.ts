import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBooking,
  declineBookingPendingResolution,
  BookingNotDeclinableError,
} from "@/lib/bookings";

// Mirrors old SupplierBookingController::decline's status-guard and
// company-ownership check. As of the BookingCredit rebook-or-refund feature
// (2026-07-21), decline no longer fires an immediate Stripe refund — it
// issues a refundObligated BookingCredit and leaves the booking
// `declined_pending_resolution` until the user resolves it (rebook via
// POST /api/bookings' bookingCreditId, or claim a refund via
// POST /api/bookings/[id]/claim-refund) — see
// declineBookingPendingResolution's own header comment in lib/bookings.ts.
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
    const updated = await declineBookingPendingResolution(bookingId, reason);
    return NextResponse.json({ booking: serializeBooking(updated) });
  } catch (error) {
    if (error instanceof BookingNotDeclinableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
