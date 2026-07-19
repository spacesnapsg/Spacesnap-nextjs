import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  BookingNotCompletedError,
  BookingNotOwnedError,
  RatingAlreadyExistsError,
  createRating,
  parseRatingCreateFields,
  serializeRating,
} from "@/lib/ratings";

// POST: the booking's own user rates a completed booking. New feature, no
// old-backend route to mirror — see lib/ratings.ts for the validation rules.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const bookingId = parseBigIntParam(id);
  if (bookingId === null) return notFoundResponse("Booking not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseRatingCreateFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    const rating = await createRating(bookingId, session.user.id, fields);
    return NextResponse.json({ rating: serializeRating(rating) }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingNotOwnedError) {
      return notFoundResponse("Booking not found.");
    }
    if (error instanceof BookingNotCompletedError || error instanceof RatingAlreadyExistsError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
