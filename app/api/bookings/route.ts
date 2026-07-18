import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { missingCertificateIds, parseBookingCreateFields, serializeBooking } from "@/lib/bookings";

const PRICE_FIELD = { daily: "priceDay", weekly: "priceWeek", monthly: "priceMonth" } as const;

// POST: create a booking. Mirrors old BookingController::store's shape
// (consumables rejection, cert-existence check, overlap-constraint 409) —
// per Sprint 3 Session 4 scope, this is CRUD shape only. Deliberately NOT
// wired here (Sprint 3.5's job): credit_balance check, credit deduction, and
// the debit Transaction record. `credits` is still computed and stored on
// the Booking row (it's a NOT NULL column), just not moved anywhere yet.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseBookingCreateFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const listing = await prisma.listing.findUnique({ where: { id: fields.listingId } });
  if (!listing) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["listingId does not exist."] }));
  }

  if (listing.type === "consumables") {
    return validationErrorResponse(
      new ApiValidationError({
        listingId: ["Consumables cannot be booked directly — submit a bulk order request instead."],
      })
    );
  }

  const missing = await missingCertificateIds(fields.listingId, session.user.id);
  if (missing.length > 0) {
    const certificates = await prisma.certificate.findMany({
      where: { id: { in: missing } },
      select: { name: true },
    });
    return NextResponse.json(
      {
        message: "You are missing required certificates for this listing.",
        missingCertificates: certificates.map((c) => c.name),
      },
      { status: 422 }
    );
  }

  const priceField = PRICE_FIELD[fields.bookingType];
  const cost = listing[priceField];
  if (cost === null) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["This listing has no price set for that booking type."] }));
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        userId: session.user.id,
        listingId: fields.listingId,
        bookingType: fields.bookingType,
        startDate: new Date(fields.startDate),
        endDate: new Date(fields.endDate),
        credits: cost,
      },
    });

    return NextResponse.json({ booking: serializeBooking(booking) }, { status: 201 });
  } catch (error) {
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "23P01") {
      return NextResponse.json({ message: "This listing is not available for the selected dates." }, { status: 409 });
    }
    throw error;
  }
}
