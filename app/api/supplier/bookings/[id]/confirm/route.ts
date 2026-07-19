import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { missingCertificateIds, serializeBooking, confirmBookingWithAudit, BookingNotConfirmableError } from "@/lib/bookings";

// Mirrors old SupplierBookingController::confirm (company-ownership check
// via BookingPolicy::update, re-checks certs at confirm time). Sprint 3.5
// known-gap #2: confirm now creates its own audit-trail Transaction row via
// confirmBookingWithAudit (see lib/bookings.ts for why that row is a
// zero-amount entry rather than a second debit — credits are already fully
// debited at booking creation in this design, same as the old build).
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

  const missing = await missingCertificateIds(booking.listingId, booking.userId);
  if (missing.length > 0) {
    const certificates = await prisma.certificate.findMany({
      where: { id: { in: missing } },
      select: { name: true },
    });
    return NextResponse.json(
      {
        message: "Requester is missing required certificates for this listing.",
        missingCertificates: certificates.map((c) => c.name),
      },
      { status: 422 }
    );
  }

  try {
    const updated = await confirmBookingWithAudit(bookingId);
    return NextResponse.json({ booking: serializeBooking(updated) });
  } catch (error) {
    if (error instanceof BookingNotConfirmableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
