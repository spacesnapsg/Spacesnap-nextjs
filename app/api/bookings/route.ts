import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  BOOKING_OVERLAP_MESSAGE,
  createBookingWithDebit,
  hasOverlappingBooking,
  InsufficientCreditBalanceError,
  missingCertificateIds,
  parseBookingCreateFields,
  serializeBooking,
} from "@/lib/bookings";

const PRICE_FIELD = { daily: "priceDay", weekly: "priceWeek", monthly: "priceMonth" } as const;

// POST: create a booking. Mirrors old BookingController::store's shape
// (consumables rejection, cert-existence check, overlap-constraint 409), plus
// the Sprint 3.5 ledger gap closed here: the credit_balance check, Booking
// insert, and debit Transaction row all happen inside a single DB transaction
// via createBookingWithDebit (lib/bookings.ts) — not two separate operations.
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

  const overlapping = await hasOverlappingBooking(fields.listingId, fields.startDate, fields.endDate);
  if (overlapping) {
    return NextResponse.json({ message: BOOKING_OVERLAP_MESSAGE }, { status: 409 });
  }

  try {
    const booking = await createBookingWithDebit({
      userId: session.user.id,
      listingId: fields.listingId,
      bookingType: fields.bookingType,
      startDate: fields.startDate,
      endDate: fields.endDate,
      cost,
    });

    return NextResponse.json({ booking: serializeBooking(booking) }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientCreditBalanceError) {
      return validationErrorResponse(new ApiValidationError({ credits: [error.message] }));
    }
    // Race window between the app-layer check above and this insert: the DB
    // constraint (bookings_no_overlap) is the actual source of truth and
    // still fires here if another request's booking landed in between.
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "23P01") {
      return NextResponse.json({ message: BOOKING_OVERLAP_MESSAGE }, { status: 409 });
    }
    throw error;
  }
}
