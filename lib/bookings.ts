import { BookingType, BookingStatus, TransactionType, type Booking, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { getMissingCertificates } from "@/lib/certificate-gating";

const BOOKING_TYPES = new Set<string>(Object.values(BookingType));

// Shared with the 23P01 catch in app/api/bookings/route.ts so both the
// app-layer pre-check and the DB-constraint race-condition fallback surface
// the identical user-facing message.
export const BOOKING_OVERLAP_MESSAGE = "This listing is not available for the selected dates.";

const bookingWithRelationsArgs = {
  include: { listing: { include: { requiredCertificates: { include: { certificate: true } } } }, user: true },
} satisfies Prisma.BookingDefaultArgs;

export type BookingWithRelations = Prisma.BookingGetPayload<typeof bookingWithRelationsArgs>;

export function serializeBooking(booking: Booking | BookingWithRelations) {
  return {
    id: booking.id.toString(),
    userId: booking.userId,
    listingId: booking.listingId.toString(),
    bookingType: booking.bookingType,
    startDate: booking.startDate.toISOString().slice(0, 10),
    endDate: booking.endDate.toISOString().slice(0, 10),
    credits: Number(booking.credits),
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    ...("listing" in booking
      ? {
          listingName: booking.listing.name,
          requiredCertificates: booking.listing.requiredCertificates.map((r) => ({
            certificateId: r.certificate.id.toString(),
            certificateName: r.certificate.name,
          })),
        }
      : {}),
    ...("user" in booking ? { userName: booking.user.name, userEmail: booking.user.email } : {}),
  };
}

interface ParsedBookingFields {
  listingId: bigint;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Mirrors old BookingController::store's validation rules.
export function parseBookingCreateFields(body: unknown): ParsedBookingFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let listingId: bigint | null = null;
  const rawListingId = typeof b.listingId === "number" ? String(b.listingId) : b.listingId;
  if (typeof rawListingId !== "string" || !/^\d+$/.test(rawListingId)) {
    errors.listingId = ["listingId is required."];
  } else {
    listingId = BigInt(rawListingId);
  }

  if (typeof b.bookingType !== "string" || !BOOKING_TYPES.has(b.bookingType)) {
    errors.bookingType = ["bookingType must be one of daily, weekly, monthly."];
  }

  if (!isDateString(b.startDate)) {
    errors.startDate = ["startDate is required."];
  }

  if (!isDateString(b.endDate)) {
    errors.endDate = ["endDate is required."];
  } else if (isDateString(b.startDate) && Date.parse(b.endDate as string) < Date.parse(b.startDate as string)) {
    errors.endDate = ["endDate must be on or after startDate."];
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return {
    listingId: listingId!,
    bookingType: b.bookingType as BookingType,
    startDate: b.startDate as string,
    endDate: b.endDate as string,
  };
}

// Fetches the required/held certificate ids and delegates the actual gating
// decision (required minus held-and-not-expired) to the pure set-difference
// module — see lib/certificate-gating.ts. Mirrors BookingController::store
// and SupplierBookingController's shared missing-certificate check.
export async function missingCertificateIds(listingId: bigint, userId: string): Promise<bigint[]> {
  const [required, held] = await Promise.all([
    prisma.listingRequiredCertificate.findMany({ where: { listingId }, select: { certificateId: true } }),
    prisma.userCertificate.findMany({
      where: { userId },
      select: { certificateId: true, expiryDate: true },
    }),
  ]);

  const missingIds = new Set(
    getMissingCertificates(
      required.map((r) => r.certificateId.toString()),
      held.map((h) => ({ certificateId: h.certificateId.toString(), expiryDate: h.expiryDate }))
    )
  );
  return required.map((r) => r.certificateId).filter((id) => missingIds.has(id.toString()));
}

// App-layer mirror of the bookings_no_overlap exclusion constraint
// (prisma/migrations/20260718171742_bookings_no_overlap_exclude): same rule,
// same inclusive date bounds, same "any non-cancelled status still holds the
// slot." Lets the common case return a clean error without ever reaching
// Postgres's 23P01 — the DB constraint stays as the last line of defense for
// the race between this check and the insert (see route.ts).
export async function hasOverlappingBooking(listingId: bigint, startDate: string, endDate: string): Promise<boolean> {
  const overlapping = await prisma.booking.findFirst({
    where: {
      listingId,
      status: { not: "cancelled" },
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) },
    },
    select: { id: true },
  });
  return overlapping !== null;
}

// Thrown inside createBookingWithDebit's transaction when the ledger balance
// is below the booking's cost. Caught in the route and turned into a clean
// 422 — there's no DB constraint backstopping this (unlike the overlap
// exclusion constraint), so the app-layer check is the only line of defense.
export class InsufficientCreditBalanceError extends Error {
  constructor(
    public readonly balance: Prisma.Decimal,
    public readonly required: Prisma.Decimal
  ) {
    super("Insufficient credit balance for this booking.");
  }
}

// Balance is never stored denormalized (see the Transaction model's comment
// in schema.prisma) — it's always the live SUM of the user's ledger rows.
// Accepts a $transaction callback's tx client so the read can happen inside
// the same transaction as the debit write in createBookingWithDebit below.
export async function getCreditBalance(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const result = await client.transaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

interface CreateBookingWithDebitParams {
  userId: string;
  listingId: bigint;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
  cost: Prisma.Decimal;
}

// Sprint 3.5 known-gap #1: balance check, Booking insert, and the ledger
// debit all happen inside one DB transaction, so a booking can never exist
// without a matching debit row and a debit never happens without the booking.
// Cert-gating, overlap, and consumables checks stay as pre-checks in the
// route, run before this transaction opens (unchanged).
// Note: this doesn't add serializable isolation, so two concurrent requests
// from the same near-empty-balance user could both read a sufficient balance
// before either commits (analogous to the overlap race Sprint 4 Item 3
// closed with a DB exclusion constraint) — there's no equivalent DB-level
// non-negative-balance constraint here yet. Out of this item's scope, not
// silently missed.
export async function createBookingWithDebit(params: CreateBookingWithDebitParams): Promise<Booking> {
  return prisma.$transaction(async (tx) => {
    const balance = await getCreditBalance(params.userId, tx);
    if (balance.lt(params.cost)) {
      throw new InsufficientCreditBalanceError(balance, params.cost);
    }

    const booking = await tx.booking.create({
      data: {
        userId: params.userId,
        listingId: params.listingId,
        bookingType: params.bookingType,
        startDate: new Date(params.startDate),
        endDate: new Date(params.endDate),
        credits: params.cost,
      },
    });

    await tx.transaction.create({
      data: {
        userId: params.userId,
        bookingId: booking.id,
        type: TransactionType.booking,
        amount: params.cost.negated(),
      },
    });

    return booking;
  });
}

// Thrown inside confirmBookingWithAudit when the booking isn't in `pending`
// status. Caught in the route and turned into a clean 422, mirroring
// InsufficientCreditBalanceError's pattern above.
export class BookingNotConfirmableError extends Error {
  constructor(public readonly status: BookingStatus) {
    super(`Booking is already ${status} and cannot be confirmed.`);
  }
}

// Sprint 3.5 known-gap #2: confirm needs its own audit-trail Transaction row
// (per the Transaction model's own schema comment, which lists "booking
// confirm" as a distinct credit-affecting event from "booking create debit").
//
// Checked against both this design and the old Laravel build
// (BookingController::store vs. SupplierBookingController::confirm) before
// writing this: credits are debited in full at booking *creation*
// (createBookingWithDebit above) in both systems — old and new. Confirm
// never moved money in the old build either; it only flipped status, which
// is exactly the gap CLAUDE1.md's Sprint 3 Session 4 notes flagged. So this
// function does not create a second debit (that would double-charge the
// user for one booking) — it records a zero-amount audit entry tying the
// confirm event to the booking, without altering the ledger sum.
export async function confirmBookingWithAudit(bookingId: bigint): Promise<BookingWithRelations> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== BookingStatus.pending) {
      throw new BookingNotConfirmableError(booking.status);
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "confirmed" },
      include: bookingWithRelationsArgs.include,
    });

    await tx.transaction.create({
      data: {
        userId: updated.userId,
        bookingId: updated.id,
        type: TransactionType.booking,
        amount: new Prisma.Decimal(0),
        description: `Booking #${updated.id} confirmed — credits were already debited at creation, no additional ledger movement here.`,
      },
    });

    return updated;
  });
}
