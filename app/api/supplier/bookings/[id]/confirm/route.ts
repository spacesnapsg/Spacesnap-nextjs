import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { missingCertificateIds, serializeBooking } from "@/lib/bookings";

// Mirrors old SupplierBookingController::confirm (company-ownership check
// via BookingPolicy::update, re-checks certs at confirm time). Per Sprint 3
// Session 4 scope, does NOT create a Transaction record here — the old build
// never wired one on confirm either (that's the audit-trail gap Sprint 3.5
// is explicitly re-implementing correctly, not a regression introduced now).
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

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "confirmed" },
    include: { listing: { include: { requiredCertificates: { include: { certificate: true } } } }, user: true },
  });

  return NextResponse.json({ booking: serializeBooking(updated) });
}
