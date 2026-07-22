import { BookingStatus, ActivityActionType, type CheckIn } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { createCompletedBookingPayable } from "@/lib/supplier-payables";
import { grantRewardTierRebate, maybeConvertReferral } from "@/lib/reward-tiers";

export function serializeCheckIn(checkIn: CheckIn) {
  return {
    id: checkIn.id.toString(),
    userId: checkIn.userId,
    listingId: checkIn.listingId.toString(),
    bookingId: checkIn.bookingId?.toString() ?? null,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    checkedOutAt: checkIn.checkedOutAt?.toISOString() ?? null,
  };
}

interface ParsedCheckInFields {
  listingId: bigint;
  bookingId: bigint | null;
}

export function parseCheckInFields(body: unknown): ParsedCheckInFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let listingId: bigint | null = null;
  const rawListingId = typeof b.listingId === "number" ? String(b.listingId) : b.listingId;
  if (typeof rawListingId !== "string" || !/^\d+$/.test(rawListingId)) {
    errors.listingId = ["listingId is required."];
  } else {
    listingId = BigInt(rawListingId);
  }

  let bookingId: bigint | null = null;
  if (b.bookingId !== undefined && b.bookingId !== null) {
    const rawBookingId = typeof b.bookingId === "number" ? String(b.bookingId) : b.bookingId;
    if (typeof rawBookingId !== "string" || !/^\d+$/.test(rawBookingId)) {
      errors.bookingId = ["bookingId must be a valid id."];
    } else {
      bookingId = BigInt(rawBookingId);
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { listingId: listingId!, bookingId };
}

// Thrown inside createCheckIn when a bookingId is supplied but the booking
// isn't `confirmed`. Caught in the route and turned into a 422, mirroring
// BookingNotConfirmableError/BookingNotDeclinableError in lib/bookings.ts.
export class BookingNotCheckInableError extends Error {
  constructor(public readonly status: BookingStatus) {
    super(`Booking is ${status} and cannot be checked in.`);
  }
}

interface CreateCheckInParams {
  userId: string;
  listingId: bigint;
  bookingId: bigint | null;
}

// Confirmed with the user before building (see check_ins schema comment in
// schema.prisma): check-in flips a `confirmed` booking to `active`. Only
// applies when bookingId is set — a bare check-in (no booking) never touches
// Booking.status. The booking-ownership/listing-match checks happen in the
// route before this is called (same shape as createBookingWithDebit in
// lib/bookings.ts); this function re-checks status inside the transaction so
// the check stays atomic with the write.
export async function createCheckIn(params: CreateCheckInParams): Promise<CheckIn> {
  return prisma.$transaction(async (tx) => {
    if (params.bookingId !== null) {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: params.bookingId } });
      if (booking.status !== BookingStatus.confirmed) {
        throw new BookingNotCheckInableError(booking.status);
      }
      await tx.booking.update({ where: { id: params.bookingId }, data: { status: BookingStatus.active } });
    }

    const checkIn = await tx.checkIn.create({
      data: {
        userId: params.userId,
        listingId: params.listingId,
        bookingId: params.bookingId,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: params.userId,
        actionType: ActivityActionType.check_in,
        description: `Checked in at listing #${params.listingId}.`,
        relatedListingId: params.listingId,
      },
    });

    return checkIn;
  });
}

// Thrown inside checkOutCheckIn when the check-in already has a checkedOutAt.
export class CheckInAlreadyCheckedOutError extends Error {
  constructor() {
    super("This check-in has already been checked out.");
  }
}

// Thrown inside checkOutCheckIn when the check-in's booking isn't `active`
// (shouldn't happen in the normal flow since createCheckIn is the only writer
// of `active`, but guarded the same way confirm/decline guard their own
// preconditions).
export class BookingNotCheckOutableError extends Error {
  constructor(public readonly status: BookingStatus) {
    super(`Booking is ${status} and cannot be checked out.`);
  }
}

// Check-in flips confirmed -> active; check-out flips active -> completed.
// Same nullable-bookingId rule as createCheckIn: a bare check-in's check-out
// never touches Booking.status.
export async function checkOutCheckIn(checkInId: bigint): Promise<CheckIn> {
  return prisma.$transaction(async (tx) => {
    const checkIn = await tx.checkIn.findUniqueOrThrow({ where: { id: checkInId } });
    if (checkIn.checkedOutAt !== null) {
      throw new CheckInAlreadyCheckedOutError();
    }

    if (checkIn.bookingId !== null) {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: checkIn.bookingId } });
      if (booking.status !== BookingStatus.active) {
        throw new BookingNotCheckOutableError(booking.status);
      }
      await tx.booking.update({
        where: { id: checkIn.bookingId },
        data: { status: BookingStatus.completed, completedAt: new Date() },
      });
      // Records what the supplier actually earned now that the service was
      // rendered — see lib/supplier-payables.ts. A cancelled/declined
      // booking never reaches this path, so it never gets a fabricated
      // earning row (see the correction in lib/bookings.ts).
      await createCompletedBookingPayable(tx, checkIn.bookingId);
      // Sprint 6.5 — User Reward Tier: pays out the rebate % snapshotted at
      // this booking's creation, and checks whether this (the booking's own
      // user, not necessarily whoever physically checked in) is a referred
      // user completing their first qualifying booking. See
      // lib/reward-tiers.ts for both functions' full design.
      await grantRewardTierRebate(tx, checkIn.bookingId);
      await maybeConvertReferral(tx, booking.userId, checkIn.bookingId, booking.sgdAmount);
    }

    const updated = await tx.checkIn.update({
      where: { id: checkInId },
      data: { checkedOutAt: new Date() },
    });

    await tx.activityLog.create({
      data: {
        userId: checkIn.userId,
        actionType: ActivityActionType.check_out,
        description: `Checked out of listing #${checkIn.listingId}.`,
        relatedListingId: checkIn.listingId,
      },
    });

    // Separate row from check_out above: check_out is the check-in/out
    // action itself (fires for bare check-ins too), this is the booking's
    // lifecycle transition — the "Booking #X" text matches the same
    // matchBookingId convention booking_created/confirmed/declined use, so
    // the frontend can tie the rating control to this row specifically
    // (see app/(user)/user/page.tsx) rather than to the created/confirmed
    // rows, which is why a bare check-in must not write this.
    if (checkIn.bookingId !== null) {
      await tx.activityLog.create({
        data: {
          userId: checkIn.userId,
          actionType: ActivityActionType.booking_completed,
          description: `Booking #${checkIn.bookingId} completed.`,
          relatedListingId: checkIn.listingId,
        },
      });
    }

    return updated;
  });
}
