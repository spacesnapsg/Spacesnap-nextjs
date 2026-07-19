import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, forbiddenResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { BookingNotCheckInableError, createCheckIn, parseCheckInFields, serializeCheckIn } from "@/lib/check-ins";

// POST: check in the requesting user, optionally against one of their own
// bookings. Sprint 3.5 new schema item — see the check_ins schema comment in
// schema.prisma for the confirmed product decision that check-in flips a
// `confirmed` booking to `active` (only when bookingId is supplied).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseCheckInFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const listing = await prisma.listing.findUnique({ where: { id: fields.listingId } });
  if (!listing) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["listingId does not exist."] }));
  }

  if (fields.bookingId !== null) {
    const booking = await prisma.booking.findUnique({ where: { id: fields.bookingId } });
    if (!booking) {
      return validationErrorResponse(new ApiValidationError({ bookingId: ["bookingId does not exist."] }));
    }
    if (booking.userId !== session.user.id) {
      return forbiddenResponse("You do not have access to this booking.");
    }
    if (booking.listingId !== fields.listingId) {
      return validationErrorResponse(new ApiValidationError({ bookingId: ["bookingId does not match listingId."] }));
    }
  }

  try {
    const checkIn = await createCheckIn({
      userId: session.user.id,
      listingId: fields.listingId,
      bookingId: fields.bookingId,
    });
    return NextResponse.json({ checkIn: serializeCheckIn(checkIn) }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingNotCheckInableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
