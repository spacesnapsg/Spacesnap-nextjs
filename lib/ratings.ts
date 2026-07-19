import type { Rating } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

// New feature — no old-backend equivalent to mirror. One rating per booking
// (@@unique on booking_id), gated to completed bookings owned by the caller.
// Not editable after submit (no PATCH/PUT route) — resubmitting hits the
// uniqueness guard below, same as the DB constraint would.
export class BookingNotOwnedError extends Error {
  constructor() {
    super("This booking does not belong to you.");
  }
}

export class BookingNotCompletedError extends Error {
  constructor() {
    super("Only completed bookings can be rated.");
  }
}

export class RatingAlreadyExistsError extends Error {
  constructor() {
    super("This booking has already been rated.");
  }
}

interface ParsedRatingFields {
  score: number;
  comment: string | null;
}

export function parseRatingCreateFields(body: unknown): ParsedRatingFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let score: number | null = null;
  if (typeof b.score !== "number" || !Number.isInteger(b.score) || b.score < 1 || b.score > 5) {
    errors.score = ["score must be an integer from 1 to 5."];
  } else {
    score = b.score;
  }

  let comment: string | null = null;
  if (b.comment !== undefined && b.comment !== null) {
    if (typeof b.comment !== "string") {
      errors.comment = ["comment must be a string."];
    } else {
      comment = b.comment.trim() || null;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { score: score!, comment };
}

export function serializeRating(rating: Rating) {
  return {
    id: rating.id.toString(),
    bookingId: rating.bookingId.toString(),
    listingId: rating.listingId.toString(),
    score: rating.score,
    comment: rating.comment,
    createdAt: rating.createdAt.toISOString(),
  };
}

// Validates ownership + completed status + not-already-rated, then creates
// the row. listingId is copied off the booking rather than trusted from the
// request, same reasoning as every other "denormalized for aggregates" field
// in this schema (e.g. Transaction doesn't trust a client-supplied amount).
export async function createRating(
  bookingId: bigint,
  userId: string,
  fields: ParsedRatingFields
): Promise<Rating> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.userId !== userId) {
    throw new BookingNotOwnedError();
  }
  if (booking.status !== "completed") {
    throw new BookingNotCompletedError();
  }

  const existing = await prisma.rating.findUnique({ where: { bookingId } });
  if (existing) {
    throw new RatingAlreadyExistsError();
  }

  return prisma.rating.create({
    data: {
      bookingId,
      userId,
      listingId: booking.listingId,
      score: fields.score,
      comment: fields.comment,
    },
  });
}

export interface ListingRatingAggregate {
  averageRating: number | null;
  ratingCount: number;
}

// Bulk aggregate for a set of listing ids — used by the listings routes so
// marketplace cards get avg+count in the same request, not one round trip
// per card.
export async function getListingRatingAggregates(
  listingIds: bigint[]
): Promise<Map<string, ListingRatingAggregate>> {
  if (listingIds.length === 0) return new Map();

  const grouped = await prisma.rating.groupBy({
    by: ["listingId"],
    where: { listingId: { in: listingIds } },
    _avg: { score: true },
    _count: { _all: true },
  });

  const map = new Map<string, ListingRatingAggregate>();
  for (const row of grouped) {
    map.set(row.listingId.toString(), {
      averageRating: row._avg.score,
      ratingCount: row._count._all,
    });
  }
  return map;
}
