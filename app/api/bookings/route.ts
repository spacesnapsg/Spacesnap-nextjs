import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@/app/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  BOOKING_OVERLAP_MESSAGE,
  createBookingWithDebit,
  hasOverlappingBooking,
  missingCertificateIds,
  parseBookingCreateFields,
  RewardGrantNotRedeemableError,
  BookingCreditNotApplicableError,
  serializeBooking,
  StripeChargeFailedError,
  StripeRefundFailedError,
} from "@/lib/bookings";

const PRICE_FIELD = { daily: "priceDay", weekly: "priceWeek", monthly: "priceMonth" } as const;
const BOOKING_STATUSES = new Set<string>(Object.values(BookingStatus));

// GET: the caller's own bookings (not company-scoped like /api/supplier/bookings).
// New — needed for the "rate your past bookings" feature on the user dashboard,
// same "no GET to list a user's own bookings" gap already tracked in the sprint
// plan, closed here as part of that feature rather than left stubbed.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const status = new URL(request.url).searchParams.get("status");
  if (status && !BOOKING_STATUSES.has(status)) {
    return NextResponse.json(
      { message: "status must be one of pending, confirmed, active, completed, cancelled." },
      { status: 422 }
    );
  }

  const bookings = await prisma.booking.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as BookingStatus } : {}),
    },
    include: { listing: true, rating: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bookings: bookings.map(serializeBooking) });
}

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
      paymentMethodId: fields.paymentMethodId,
      rewardGrantId: fields.rewardGrantId,
      bookingCreditId: fields.bookingCreditId,
    });

    return NextResponse.json({ booking: serializeBooking(booking) }, { status: 201 });
  } catch (error) {
    if (error instanceof RewardGrantNotRedeemableError) {
      return validationErrorResponse(new ApiValidationError({ rewardGrantId: [error.message] }));
    }
    if (error instanceof BookingCreditNotApplicableError) {
      return validationErrorResponse(new ApiValidationError({ bookingCreditId: [error.message] }));
    }
    if (error instanceof StripeChargeFailedError) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }
    if (error instanceof StripeRefundFailedError) {
      return NextResponse.json({ message: error.message }, { status: 502 });
    }
    // Race window between the app-layer check above and this insert: the DB
    // constraint (bookings_no_overlap) is the actual source of truth and
    // still fires here if another request's booking landed in between.
    // createBookingWithDebit has already refunded the Stripe charge by the
    // time this error surfaces (see its own catch block).
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "23P01") {
      return NextResponse.json({ message: BOOKING_OVERLAP_MESSAGE }, { status: 409 });
    }
    throw error;
  }
}
