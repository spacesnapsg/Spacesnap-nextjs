import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { serializeBooking } from "@/lib/bookings";

// Mirrors old SupplierBookingController::decline's status-guard and
// company-ownership check. Per Sprint 3 Session 4 scope, deliberately does
// NOT create the refund Transaction the old build made here — that's
// Sprint 3.5's "decline: refund path creates a credit Transaction record
// correctly" item. This just flips status to cancelled; the credit refund is
// stubbed pending the ledger pass.
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

  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return NextResponse.json(
      { message: `Booking is already ${booking.status} and cannot be declined.` },
      { status: 422 }
    );
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "cancelled" },
    include: { listing: { include: { requiredCertificates: { include: { certificate: true } } } }, user: true },
  });

  return NextResponse.json({ booking: serializeBooking(updated) });
}
