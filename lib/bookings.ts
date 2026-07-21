import {
  BookingType,
  BookingStatus,
  BookingCancelledBy,
  TransactionType,
  ActivityActionType,
  RewardGrantType,
  type Booking,
  Prisma,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { getMissingCertificates } from "@/lib/certificate-gating";
import { stripe, toStripeCents } from "@/lib/stripe";
import { resolveRewardGrantDiscount, redeemRewardGrant, RewardGrantNotRedeemableError } from "@/lib/reward-grants";
import {
  calculateUserCancellationRefund,
  calculateSupplierCancellationPenalty,
  calculateModificationTerms,
  applyRefundCap,
  PLATFORM_COMMISSION_PERCENT_BOOKINGS,
  invoicingCadenceForSupplierTier,
} from "@/lib/booking-payments";

export { RewardGrantNotRedeemableError };

// Thrown when the Stripe PaymentIntent create/confirm call itself fails, or
// resolves to a non-`succeeded` status (e.g. `requires_action` for 3DS) —
// this session's flow is server-side test tokens only (no Stripe Elements
// client), so a status other than immediate success is treated as a hard
// failure rather than something the route can walk the user through.
export class StripeChargeFailedError extends Error {
  constructor(public readonly cause: unknown) {
    super("Payment could not be processed.");
  }
}

const BOOKING_TYPES = new Set<string>(Object.values(BookingType));

// Shared with the 23P01 catch in app/api/bookings/route.ts so both the
// app-layer pre-check and the DB-constraint race-condition fallback surface
// the identical user-facing message.
export const BOOKING_OVERLAP_MESSAGE = "This listing is not available for the selected dates.";

const bookingWithRelationsArgs = {
  include: { listing: { include: { requiredCertificates: { include: { certificate: true } } } }, user: true },
} satisfies Prisma.BookingDefaultArgs;

export type BookingWithRelations = Prisma.BookingGetPayload<typeof bookingWithRelationsArgs>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bookingWithRatingArgs = {
  include: { listing: true, rating: true },
} satisfies Prisma.BookingDefaultArgs;

export type BookingWithRating = Prisma.BookingGetPayload<typeof bookingWithRatingArgs>;

export function serializeBooking(booking: Booking | BookingWithRelations | BookingWithRating) {
  return {
    id: booking.id.toString(),
    userId: booking.userId,
    listingId: booking.listingId.toString(),
    bookingType: booking.bookingType,
    startDate: booking.startDate.toISOString().slice(0, 10),
    endDate: booking.endDate.toISOString().slice(0, 10),
    sgdAmount: Number(booking.sgdAmount),
    earnedCreditsApplied: Number(booking.earnedCreditsApplied),
    status: booking.status,
    isModified: booking.isModified,
    originalStartDate: booking.originalStartDate ? booking.originalStartDate.toISOString().slice(0, 10) : null,
    maxRefundablePercent: booking.maxRefundablePercent ? Number(booking.maxRefundablePercent) : null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    ...("listing" in booking
      ? {
          listingName: booking.listing.name,
          listingType: booking.listing.type,
          ...("requiredCertificates" in booking.listing
            ? {
                requiredCertificates: booking.listing.requiredCertificates.map((r) => ({
                  certificateId: r.certificate.id.toString(),
                  certificateName: r.certificate.name,
                })),
              }
            : {}),
        }
      : {}),
    ...("user" in booking
      ? { userName: booking.user.name, userEmail: booking.user.email, userTitle: booking.user.title }
      : {}),
    ...("rating" in booking
      ? {
          rating: booking.rating
            ? { id: booking.rating.id.toString(), score: booking.rating.score, comment: booking.rating.comment }
            : null,
        }
      : {}),
  };
}

interface ParsedBookingFields {
  listingId: bigint;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
  paymentMethodId: string;
  rewardGrantId?: bigint;
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

  // 2026-07-21: booking creation charges real-time SGD via Stripe (see
  // createBookingWithDebit, lib/bookings.ts) — a Stripe PaymentMethod id is
  // now required on every request. This session's flow is server-side test
  // tokens only (no Stripe Elements client), so no card-collection UI is
  // implied by this field.
  if (typeof b.paymentMethodId !== "string" || b.paymentMethodId.length === 0) {
    errors.paymentMethodId = ["paymentMethodId is required."];
  }

  let rewardGrantId: bigint | undefined;
  if (b.rewardGrantId !== undefined && b.rewardGrantId !== null) {
    const rawGrantId = typeof b.rewardGrantId === "number" ? String(b.rewardGrantId) : b.rewardGrantId;
    if (typeof rawGrantId !== "string" || !/^\d+$/.test(rawGrantId)) {
      errors.rewardGrantId = ["rewardGrantId must be an id."];
    } else {
      rewardGrantId = BigInt(rawGrantId);
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return {
    listingId: listingId!,
    bookingType: b.bookingType as BookingType,
    startDate: b.startDate as string,
    endDate: b.endDate as string,
    paymentMethodId: b.paymentMethodId as string,
    rewardGrantId,
  };
}

interface ParsedModifyBookingFields {
  newStartDate: string;
  paymentMethodId?: string;
}

// Sprint 4.75 — "Modify Booking." Mirrors parseBookingCreateFields's shape
// (validate-then-throw ApiValidationError). paymentMethodId is optional at
// the parse layer — whether it's actually required depends on which notice-
// day fee tier the booking lands in, which parsing alone can't know (that's
// modifyBookingWithFee's job, via ModificationPaymentMethodRequiredError).
export function parseModifyBookingFields(body: unknown): ParsedModifyBookingFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (!isDateString(b.newStartDate)) {
    errors.newStartDate = ["newStartDate is required."];
  } else {
    const todayUtcMidnight = new Date();
    todayUtcMidnight.setUTCHours(0, 0, 0, 0);
    if (Date.parse(b.newStartDate as string) < todayUtcMidnight.getTime()) {
      errors.newStartDate = ["newStartDate cannot be in the past."];
    }
  }

  let paymentMethodId: string | undefined;
  if (b.paymentMethodId !== undefined && b.paymentMethodId !== null) {
    if (typeof b.paymentMethodId !== "string" || b.paymentMethodId.length === 0) {
      errors.paymentMethodId = ["paymentMethodId must be a non-empty string."];
    } else {
      paymentMethodId = b.paymentMethodId;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { newStartDate: b.newStartDate as string, paymentMethodId };
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
// `excludeBookingId` (added for modifyBookingWithFee below): a booking being
// rescheduled still holds its OWN old row until the update commits, so
// checking a new date range against the table as-is would otherwise compare
// the booking against itself.
export async function hasOverlappingBooking(
  listingId: bigint,
  startDate: string,
  endDate: string,
  excludeBookingId?: bigint
): Promise<boolean> {
  const overlapping = await prisma.booking.findFirst({
    where: {
      listingId,
      status: { not: "cancelled" },
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) },
      ...(excludeBookingId !== undefined ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true },
  });
  return overlapping !== null;
}

interface CreateBookingWithDebitParams {
  userId: string;
  listingId: bigint;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
  cost: Prisma.Decimal;
  paymentMethodId: string;
  rewardGrantId?: bigint;
}

// 2026-07-21 write-path session: replaces the old combined-wallet debit with
// the purchased/earned split's actual design (see Booking's schema comment
// and TransactionType's purchased/earned comment) — a booking is charged
// full price in real-time SGD via Stripe, never from purchasedBalance, with
// an optional earnedBalance discount resolved by redeeming a specific
// RewardGrant (never a client-supplied amount).
//
// Ordering, confirmed with the product owner before writing this: the Stripe
// PaymentIntent is created *before* the DB transaction opens, since Prisma's
// $transaction can't roll back an external API call. If the DB transaction
// then fails for any reason (the overlap-constraint race, a lost
// grant-redemption race, an unexpected error), the charge has already
// succeeded — so the catch block below issues a Stripe refund before
// rethrowing, rather than leaving a charged user with no booking. This
// mirrors the "a booking never exists without its matching charge record,
// and vice versa" atomicity discipline the old combined-ledger version had,
// extended to a step Prisma's transaction can't cover on its own.
//
// Cert-gating, overlap, and consumables checks stay as pre-checks in the
// route, run before this function is even called (unchanged).
//
// Note (2026-07-21 schema session, cancellation fields): this function
// already implements the merchant-of-record, direct-charge model that
// session's brief was describing as a target to build toward — it does NOT
// debit any wallet balance for a booking, it charges Stripe directly, per
// the header comment above. Checked against schema.prisma before writing
// anything this session, since assuming otherwise would have duplicated
// work. Only decline (below) still needs the equivalent rewiring — see its
// TODO.
export async function createBookingWithDebit(params: CreateBookingWithDebitParams): Promise<Booking> {
  let discount = new Prisma.Decimal(0);
  let grantId: bigint | null = null;

  if (params.rewardGrantId !== undefined) {
    const resolved = await resolveRewardGrantDiscount(
      params.userId,
      params.rewardGrantId,
      RewardGrantType.booking_discount_pct,
      params.cost
    );
    discount = resolved.discount;
    grantId = resolved.grant.id;
  }

  const chargeAmount = params.cost.sub(discount);

  // A grant can (per its own clamp in resolveRewardGrantDiscount) cover the
  // full cost, leaving nothing to actually charge — Stripe rejects
  // zero-amount PaymentIntents outright, so this is a real case to special-
  // case, not a hypothetical. No PaymentIntent is created at all; the
  // Transaction row below records the zero-amount charge for audit parity
  // with every other booking, same "audit row, no ledger movement" idiom
  // confirmBookingWithAudit already uses elsewhere in this file.
  let paymentIntentId: string | null = null;
  if (chargeAmount.gt(0)) {
    // Deliberately not attaching `customer: user.stripeCustomerId` — the
    // seeded values there (e.g. "cus_test_ethan001") are placeholder
    // strings from prisma/seed.ts, not real Stripe Customer objects, so
    // passing one to a live Stripe API call fails with "No such customer."
    // Real customer creation/lookup is its own feature (saved payment
    // methods, customer-object lifecycle) that hasn't been built — out of
    // this session's scope (a one-off charge against a supplied
    // PaymentMethod doesn't require a Customer at all). Confirmed live
    // against the Stripe test sandbox before landing this.
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: toStripeCents(chargeAmount),
        currency: "sgd",
        payment_method: params.paymentMethodId,
        payment_method_types: ["card"],
        confirm: true,
        description: `SpaceSnap booking — listing ${params.listingId}`,
      });
    } catch (error) {
      throw new StripeChargeFailedError(error);
    }

    if (paymentIntent.status !== "succeeded") {
      throw new StripeChargeFailedError(new Error(`PaymentIntent ${paymentIntent.id} ended in status "${paymentIntent.status}".`));
    }

    paymentIntentId = paymentIntent.id;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          userId: params.userId,
          listingId: params.listingId,
          bookingType: params.bookingType,
          startDate: new Date(params.startDate),
          endDate: new Date(params.endDate),
          sgdAmount: params.cost,
          earnedCreditsApplied: discount,
          platformCommissionPercent: new Prisma.Decimal(PLATFORM_COMMISSION_PERCENT_BOOKINGS),
        },
      });

      await tx.transaction.create({
        data: {
          userId: params.userId,
          bookingId: booking.id,
          type: TransactionType.booking_payment,
          amount: chargeAmount.negated(),
          stripePaymentIntentId: paymentIntentId,
          description:
            paymentIntentId !== null
              ? `Booking #${booking.id} — ${chargeAmount} SGD charged via Stripe.`
              : `Booking #${booking.id} — fully covered by a reward discount, no Stripe charge needed.`,
        },
      });

      if (grantId !== null && discount.gt(0)) {
        await redeemRewardGrant(tx, grantId);
        await tx.transaction.create({
          data: {
            userId: params.userId,
            bookingId: booking.id,
            rewardGrantId: grantId,
            type: TransactionType.earned_spend,
            amount: discount.negated(),
            description: `Booking #${booking.id} — reward grant #${grantId} redeemed for a ${discount} SGD discount.`,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: params.userId,
          actionType: ActivityActionType.booking_created,
          description: discount.gt(0)
            ? `Booking #${booking.id} created (${chargeAmount} SGD charged, ${discount} SGD reward discount applied).`
            : `Booking #${booking.id} created (${chargeAmount} SGD charged).`,
          relatedListingId: params.listingId,
        },
      });

      return booking;
    });
  } catch (error) {
    // The Stripe charge above already succeeded (if there was one at all —
    // a fully-discounted booking has no PaymentIntent to refund) — anything
    // that fails past this point (double-booking race, lost
    // grant-redemption race, or any other DB error) must not leave the user
    // charged with no booking to show for it, so refund before rethrowing
    // the original error.
    if (paymentIntentId !== null) {
      await stripe.refunds.create({ payment_intent: paymentIntentId }).catch((refundError) => {
        // Best-effort: if even the refund fails, the original DB error below
        // is still the more actionable thing to surface to the caller, but a
        // charged-with-no-booking user needs a paper trail to reconcile from.
        console.error(
          `createBookingWithDebit: DB transaction failed AND the compensating refund also failed for PaymentIntent ${paymentIntentId}. Manual reconciliation required.`,
          refundError
        );
      });
    }
    throw error;
  }
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

    await tx.activityLog.create({
      data: {
        userId: updated.userId,
        actionType: ActivityActionType.booking_confirmed,
        description: `Booking #${updated.id} confirmed.`,
        relatedListingId: updated.listingId,
      },
    });

    return updated;
  });
}

// Thrown inside declineBookingWithRefund when the booking isn't `pending` or
// `confirmed` (i.e. it's already cancelled/active/completed). Caught in the
// route and turned into the same clean 422 the route already returned before
// this refund logic existed — see Sprint 4 Item 3 notes on the decline route.
export class BookingNotDeclinableError extends Error {
  constructor(public readonly status: BookingStatus) {
    super(`Booking is already ${status} and cannot be declined.`);
  }
}

// Thrown when the Stripe refund call itself fails. Mirrors
// StripeChargeFailedError's pattern above for the inverse operation.
export class StripeRefundFailedError extends Error {
  constructor(public readonly cause: unknown) {
    super("Refund could not be processed.");
  }
}

// Supplier-initiated cancellation. Corrected 2026-07-21 (product owner,
// closing the previous version's TODO on SupplierPayable): the user did not
// cause this, so they are always refunded in full — the cancellation-window
// day tier no longer applies to their refund. Instead it sizes the
// supplier's penalty against SpaceSnap's commission portion of the booking
// (Booking.platformCommissionPercent, snapshotted at creation).
//
// Corrected again the same day (worked example from the product owner —
// see CLAUDE1.md): a cancelled booking earns the supplier NOTHING — the
// full amount was refunded to the user, so there is no "grossAmount" to
// speak of for this booking. The SupplierPayable row written here is a pure
// penalty DEBIT (grossAmount 0, netAmount = -penaltyDeduction) against
// whatever the supplier is already owed from OTHER, actually-completed
// bookings (see createCompletedBookingPayable, lib/supplier-payables.ts) —
// the live SUM in getSupplierPendingPayableBalance is what nets a penalty
// against prior earnings, not anything computed or checked here. That SUM
// can go negative if penalties exceed pending earnings — the supplier owing
// SpaceSnap back, to be recovered on their next invoice; no automated
// collection/invoicing beyond this ledger row is built here, per the
// still-open Sprint 6 Invoice/Receipt gap.
//
// Still deliberately does NOT issue a BookingCredit for the (now
// nonexistent, since the user is always refunded in full) non-refunded
// portion — kept only as a note in case a future policy reduces the user's
// refund below 100% again.
//
// Refund math: 100% of both halves of what the user originally paid — the
// real-SGD portion actually charged to Stripe (sgdAmount - earnedCreditsApplied)
// and the earned-credit discount redeemed against a RewardGrant. The
// earned-credit portion is reversed as a ledger-only earned_grant
// Transaction; the RewardGrant row itself stays `redeemed` (its job was
// authorizing the original discount, not tracking the current balance —
// SUM(Transaction.amount) is what the balance actually reads from, per that
// model's own design principle).
//
// Known, narrow race (flagged, not engineered around): the Stripe refund
// call happens before the status-guarded DB write, same ordering
// createBookingWithDebit uses for its charge. Two concurrent decline
// requests for the same booking could both pass the pre-check and both fire
// a Stripe refund before either commits — the DB write's own re-check
// (below) prevents a double status transition/double ledger entry, but
// can't un-fire an already-issued Stripe refund. Same risk class this
// codebase already accepts for confirmBookingWithAudit's stale-read window.
export async function declineBookingWithRefund(
  bookingId: bigint,
  cancellationReason?: string
): Promise<BookingWithRelations> {
  const existing = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { listing: { include: { company: true } } },
  });
  if (existing.status !== BookingStatus.pending && existing.status !== BookingStatus.confirmed) {
    throw new BookingNotDeclinableError(existing.status);
  }

  const [paymentTransaction, earnedSpendTransaction] = await Promise.all([
    prisma.transaction.findFirst({ where: { bookingId, type: TransactionType.booking_payment } }),
    prisma.transaction.findFirst({ where: { bookingId, type: TransactionType.earned_spend } }),
  ]);

  const cancelledAt = new Date();
  const userRefundPercent = new Prisma.Decimal(100);
  const supplierPenaltyPercent = new Prisma.Decimal(calculateSupplierCancellationPenalty(existing, cancelledAt));

  const chargeAmount = existing.sgdAmount.sub(existing.earnedCreditsApplied);
  const stripeRefundAmount = chargeAmount.mul(userRefundPercent).div(100).toDecimalPlaces(2);
  const earnedReversalAmount = existing.earnedCreditsApplied.mul(userRefundPercent).div(100).toDecimalPlaces(2);
  const paymentIntentId = paymentTransaction?.stripePaymentIntentId ?? null;

  const commissionAmount = existing.sgdAmount.mul(existing.platformCommissionPercent).div(100).toDecimalPlaces(2);
  const penaltyDeduction = commissionAmount.mul(supplierPenaltyPercent).div(100).toDecimalPlaces(2);
  const invoicingCadence = invoicingCadenceForSupplierTier(existing.listing.company.supplierTier);

  if (stripeRefundAmount.gt(0) && paymentIntentId !== null) {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId, amount: toStripeCents(stripeRefundAmount) });
    } catch (error) {
      throw new StripeRefundFailedError(error);
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (booking.status !== BookingStatus.pending && booking.status !== BookingStatus.confirmed) {
        throw new BookingNotDeclinableError(booking.status);
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "cancelled",
          cancelledAt,
          cancelledBy: BookingCancelledBy.supplier,
          cancellationReason: cancellationReason ?? null,
          userRefundPercent,
          supplierPenaltyPercent,
        },
        include: bookingWithRelationsArgs.include,
      });

      if (stripeRefundAmount.gt(0)) {
        await tx.transaction.create({
          data: {
            userId: updated.userId,
            bookingId: updated.id,
            type: TransactionType.refund,
            amount: stripeRefundAmount,
            stripePaymentIntentId: paymentIntentId,
            description: `Booking #${updated.id} declined — ${userRefundPercent}% cancellation-window refund of ${stripeRefundAmount} SGD issued via Stripe.`,
          },
        });
      }

      if (earnedReversalAmount.gt(0)) {
        await tx.transaction.create({
          data: {
            userId: updated.userId,
            bookingId: updated.id,
            rewardGrantId: earnedSpendTransaction?.rewardGrantId ?? null,
            type: TransactionType.earned_grant,
            amount: earnedReversalAmount,
            description: `Booking #${updated.id} declined — ${userRefundPercent}% reversal of the ${existing.earnedCreditsApplied} SGD reward discount applied at creation.`,
          },
        });
      }

      await tx.supplierPayable.create({
        data: {
          companyId: existing.listing.companyId,
          bookingId: updated.id,
          grossAmount: new Prisma.Decimal(0),
          penaltyDeduction,
          netAmount: penaltyDeduction.negated(),
          invoicingCadence,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: updated.userId,
          actionType: ActivityActionType.booking_declined,
          description: `Booking #${updated.id} declined (${userRefundPercent}% refund: ${stripeRefundAmount} SGD${
            earnedReversalAmount.gt(0) ? ` + ${earnedReversalAmount} SGD in reversed reward credit` : ""
          }; supplier penalty ${supplierPenaltyPercent}% of commission: ${penaltyDeduction} SGD).`,
          relatedListingId: updated.listingId,
        },
      });

      return updated;
    });
  } catch (error) {
    if (stripeRefundAmount.gt(0) && paymentIntentId !== null) {
      console.error(
        `declineBookingWithRefund: Stripe refund for PaymentIntent ${paymentIntentId} already succeeded, but the DB write failed afterward. Manual reconciliation required.`,
        error
      );
    }
    throw error;
  }
}

// Thrown inside cancelBookingWithRefund when the booking isn't `pending` or
// `confirmed` (i.e. it's already cancelled/active/completed). Distinct from
// BookingNotDeclinableError so the two routes' error messages stay accurate
// to which action was attempted, even though the underlying status guard is
// identical.
export class BookingNotCancellableError extends Error {
  constructor(public readonly status: BookingStatus) {
    super(`Booking is already ${status} and cannot be cancelled.`);
  }
}

// User-initiated cancellation. The supplier did not cause this, so they are
// never penalized. The user's own refund follows the cancellation-window
// day tier (calculateUserCancellationRefund), confirmed with the product
// owner 2026-07-21 alongside the decline correction above — see that
// function's header comment in lib/booking-payments.ts for the full
// at-fault-party design.
//
// Corrected the same day (worked example from the product owner — see
// CLAUDE1.md): a cancelled booking earns the supplier NOTHING regardless of
// who cancelled it — the money was refunded to the user, not earned. The
// SupplierPayable row written here is a zero-effect audit record
// (grossAmount 0, penaltyDeduction 0, netAmount 0), not a fabricated payout
// for a booking whose service was never rendered — "the supplier is made
// whole" here just means "unaffected," not "still paid for this booking."
//
// Mirrors declineBookingWithRefund's structure (Stripe refund before the
// status-guarded DB write, same narrow race accepted, same reward-grant
// reversal idiom) — only the refund/penalty math and cancelledBy differ.
//
// Sprint 4.75 addition: the standard day-tier refund is now run through the
// Refund Cap Engine (applyRefundCap, lib/booking-payments.ts) against
// Booking.maxRefundablePercent — a booking previously modified 3-7 days out
// carries a 50% cap here, per the "Modify Booking" feature's own design (see
// modifyBookingWithFee below). `maxRefundablePercent` is null for any booking
// this feature hasn't touched, so applyRefundCap is a no-op and this is
// unchanged for every booking that was never modified.
export async function cancelBookingWithRefund(
  bookingId: bigint,
  cancellationReason?: string
): Promise<BookingWithRelations> {
  const existing = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { listing: { include: { company: true } } },
  });
  if (existing.status !== BookingStatus.pending && existing.status !== BookingStatus.confirmed) {
    throw new BookingNotCancellableError(existing.status);
  }

  const [paymentTransaction, earnedSpendTransaction] = await Promise.all([
    prisma.transaction.findFirst({ where: { bookingId, type: TransactionType.booking_payment } }),
    prisma.transaction.findFirst({ where: { bookingId, type: TransactionType.earned_spend } }),
  ]);

  const cancelledAt = new Date();
  const standardRefundPercent = calculateUserCancellationRefund(existing, cancelledAt);
  const cappedRefundPercent = applyRefundCap(
    standardRefundPercent,
    existing.maxRefundablePercent ? Number(existing.maxRefundablePercent) : null
  );
  const userRefundPercent = new Prisma.Decimal(cappedRefundPercent);
  const supplierPenaltyPercent = new Prisma.Decimal(0);

  const chargeAmount = existing.sgdAmount.sub(existing.earnedCreditsApplied);
  const stripeRefundAmount = chargeAmount.mul(userRefundPercent).div(100).toDecimalPlaces(2);
  const earnedReversalAmount = existing.earnedCreditsApplied.mul(userRefundPercent).div(100).toDecimalPlaces(2);
  const paymentIntentId = paymentTransaction?.stripePaymentIntentId ?? null;

  const invoicingCadence = invoicingCadenceForSupplierTier(existing.listing.company.supplierTier);

  if (stripeRefundAmount.gt(0) && paymentIntentId !== null) {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId, amount: toStripeCents(stripeRefundAmount) });
    } catch (error) {
      throw new StripeRefundFailedError(error);
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (booking.status !== BookingStatus.pending && booking.status !== BookingStatus.confirmed) {
        throw new BookingNotCancellableError(booking.status);
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "cancelled",
          cancelledAt,
          cancelledBy: BookingCancelledBy.user,
          cancellationReason: cancellationReason ?? null,
          userRefundPercent,
          supplierPenaltyPercent,
        },
        include: bookingWithRelationsArgs.include,
      });

      if (stripeRefundAmount.gt(0)) {
        await tx.transaction.create({
          data: {
            userId: updated.userId,
            bookingId: updated.id,
            type: TransactionType.refund,
            amount: stripeRefundAmount,
            stripePaymentIntentId: paymentIntentId,
            description: `Booking #${updated.id} cancelled by user — ${userRefundPercent}% cancellation-window refund of ${stripeRefundAmount} SGD issued via Stripe.`,
          },
        });
      }

      if (earnedReversalAmount.gt(0)) {
        await tx.transaction.create({
          data: {
            userId: updated.userId,
            bookingId: updated.id,
            rewardGrantId: earnedSpendTransaction?.rewardGrantId ?? null,
            type: TransactionType.earned_grant,
            amount: earnedReversalAmount,
            description: `Booking #${updated.id} cancelled by user — ${userRefundPercent}% reversal of the ${existing.earnedCreditsApplied} SGD reward discount applied at creation.`,
          },
        });
      }

      await tx.supplierPayable.create({
        data: {
          companyId: existing.listing.companyId,
          bookingId: updated.id,
          grossAmount: new Prisma.Decimal(0),
          penaltyDeduction: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(0),
          invoicingCadence,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: updated.userId,
          actionType: ActivityActionType.booking_cancelled,
          description: `Booking #${updated.id} cancelled by user (${userRefundPercent}% refund: ${stripeRefundAmount} SGD${
            earnedReversalAmount.gt(0) ? ` + ${earnedReversalAmount} SGD in reversed reward credit` : ""
          }; supplier paid in full, no penalty).`,
          relatedListingId: updated.listingId,
        },
      });

      return updated;
    });
  } catch (error) {
    if (stripeRefundAmount.gt(0) && paymentIntentId !== null) {
      console.error(
        `cancelBookingWithRefund: Stripe refund for PaymentIntent ${paymentIntentId} already succeeded, but the DB write failed afterward. Manual reconciliation required.`,
        error
      );
    }
    throw error;
  }
}

// Thrown inside modifyBookingWithFee when the booking isn't `pending` or
// `confirmed`. Distinct from BookingNotCancellableError/BookingNotDeclinableError
// so each route's error message stays accurate to the action attempted.
export class BookingNotModifiableError extends Error {
  constructor(public readonly status: BookingStatus) {
    super(`Booking is already ${status} and cannot be modified.`);
  }
}

// Thrown when the request comes in under 3 days' notice — per the brief,
// this is a hard reject, not a reduced-fee tier: the user must either
// fulfil the booking as scheduled or cancel it (subject to the normal
// cancellation-window refund).
export class BookingModificationNotEligibleError extends Error {
  constructor(public readonly noticeDays: number) {
    super("This booking starts too soon to be modified — please fulfil it as scheduled, or cancel it instead.");
  }
}

// Thrown when the newly-requested date range collides with another
// non-cancelled booking on the same listing. Mirrors BOOKING_OVERLAP_MESSAGE
// so this reads identically to the create-booking overlap error.
export class BookingModificationOverlapError extends Error {
  constructor() {
    super(BOOKING_OVERLAP_MESSAGE);
  }
}

// Thrown when the notice-day tier requires a modification fee but the
// caller didn't supply a paymentMethodId. Kept distinct from
// ApiValidationError since it's only knowable after reading the booking's
// own current startDate (parseModifyBookingFields can't decide this on
// request shape alone).
export class ModificationPaymentMethodRequiredError extends Error {
  constructor() {
    super("A payment method is required to cover this booking's modification fee.");
  }
}

interface ModifyBookingWithFeeParams {
  bookingId: bigint;
  newStartDate: string;
  paymentMethodId?: string;
}

// Sprint 4.75 addition (2026-07-21) — "Modify Booking," per the product
// brief's own pseudocode (Step A: Modification Request Engine). See
// calculateModificationTerms (lib/booking-payments.ts) for the notice-day
// eligibility/fee/cap tiers this wires up.
//
// Build-time decisions made here, not spelled out in the brief — flagged
// per this codebase's own convention rather than guessed at silently:
// - "booking_fee" in the brief is read as Booking.sgdAmount (the booking's
//   full nominal price snapshotted at creation), not the net amount actually
//   charged to Stripe after any earned-credit discount — the modification
//   fee is a flat cost of changing THIS booking, not scaled by how it
//   happened to be paid for. Not confirmed with the product owner.
// - The new date range preserves the booking's existing duration (new
//   endDate = newStartDate + the same day-span as the current
//   startDate..endDate) — the brief only mentions a single "new requested
//   date," and this is the only reading that doesn't require the client to
//   separately re-quote a price for a different-length stay.
// - is_modified is set true only the first time a modification lands in the
//   FEE tier, exactly matching the brief's own pseudocode (the free, >7-day
//   tier's action list does not mention it) — not reset back to false by a
//   later free modification.
// - max_refundable_percent IS reset on every modification, including a free
//   one restoring it to 100 — also per the brief's own pseudocode ("Set to
//   1.00").
// - The Refund Cap Engine this sets up (applyRefundCap) is wired into
//   cancelBookingWithRefund (user-initiated cancellation) ONLY, not
//   declineBookingWithRefund (supplier-initiated). This codebase's existing
//   at-fault-party design (see declineBookingWithRefund's own header
//   comment) makes the user whole when the SUPPLIER cancels, regardless of
//   cause — capping that refund because the user separately chose to
//   reschedule earlier would penalize the user for something the supplier
//   caused, not something this feature should introduce.
// - The fee is real money movement (Stripe), charged before the DB
//   transaction opens with the same pre-transaction-charge /
//   compensating-refund-on-failure discipline createBookingWithDebit uses —
//   Prisma's $transaction can't roll back an external API call. It is
//   deliberately non-refundable if the booking is later cancelled/declined
//   (no code path reverses a booking_modification_fee Transaction) — the fee
//   is for the act of rescheduling, not part of the stay's own price.
export async function modifyBookingWithFee(params: ModifyBookingWithFeeParams): Promise<BookingWithRelations> {
  const existing = await prisma.booking.findUniqueOrThrow({ where: { id: params.bookingId } });
  if (existing.status !== BookingStatus.pending && existing.status !== BookingStatus.confirmed) {
    throw new BookingNotModifiableError(existing.status);
  }

  const requestedAt = new Date();
  const terms = calculateModificationTerms(existing, requestedAt);
  if (!terms.eligible) {
    throw new BookingModificationNotEligibleError(terms.noticeDays);
  }

  const durationMs = existing.endDate.getTime() - existing.startDate.getTime();
  const newStart = new Date(params.newStartDate);
  const newEnd = new Date(newStart.getTime() + durationMs);

  const overlapping = await hasOverlappingBooking(
    existing.listingId,
    newStart.toISOString().slice(0, 10),
    newEnd.toISOString().slice(0, 10),
    existing.id
  );
  if (overlapping) {
    throw new BookingModificationOverlapError();
  }

  const feeAmount =
    terms.feePercent > 0 ? existing.sgdAmount.mul(terms.feePercent).div(100).toDecimalPlaces(2) : new Prisma.Decimal(0);

  if (feeAmount.gt(0) && !params.paymentMethodId) {
    throw new ModificationPaymentMethodRequiredError();
  }

  let paymentIntentId: string | null = null;
  if (feeAmount.gt(0)) {
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: toStripeCents(feeAmount),
        currency: "sgd",
        payment_method: params.paymentMethodId,
        payment_method_types: ["card"],
        confirm: true,
        description: `SpaceSnap booking #${existing.id} — modification fee`,
      });
    } catch (error) {
      throw new StripeChargeFailedError(error);
    }

    if (paymentIntent.status !== "succeeded") {
      throw new StripeChargeFailedError(new Error(`PaymentIntent ${paymentIntent.id} ended in status "${paymentIntent.status}".`));
    }

    paymentIntentId = paymentIntent.id;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: params.bookingId } });
      if (booking.status !== BookingStatus.pending && booking.status !== BookingStatus.confirmed) {
        throw new BookingNotModifiableError(booking.status);
      }

      const updated = await tx.booking.update({
        where: { id: params.bookingId },
        data: {
          startDate: newStart,
          endDate: newEnd,
          originalStartDate: booking.originalStartDate ?? booking.startDate,
          isModified: terms.feePercent > 0 ? true : booking.isModified,
          maxRefundablePercent: new Prisma.Decimal(terms.maxRefundablePercent),
        },
        include: bookingWithRelationsArgs.include,
      });

      if (feeAmount.gt(0)) {
        await tx.transaction.create({
          data: {
            userId: updated.userId,
            bookingId: updated.id,
            type: TransactionType.booking_modification_fee,
            amount: feeAmount.negated(),
            stripePaymentIntentId: paymentIntentId,
            description: `Booking #${updated.id} rescheduled (${terms.noticeDays} days notice) — ${terms.feePercent}% modification fee of ${feeAmount} SGD charged via Stripe.`,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: updated.userId,
          actionType: ActivityActionType.booking_modified,
          description:
            feeAmount.gt(0)
              ? `Booking #${updated.id} rescheduled to ${newStart.toISOString().slice(0, 10)} (${terms.noticeDays} days notice, ${feeAmount} SGD modification fee charged).`
              : `Booking #${updated.id} rescheduled to ${newStart.toISOString().slice(0, 10)} (${terms.noticeDays} days notice, no fee).`,
          relatedListingId: updated.listingId,
        },
      });

      return updated;
    });
  } catch (error) {
    // Same discipline as createBookingWithDebit's own catch: the Stripe
    // charge above (if there was one) already succeeded, so anything that
    // fails past this point (a lost overlap race caught by the DB's
    // bookings_no_overlap exclusion constraint on the update, or any other
    // DB error) must not leave the user charged a fee with no reschedule to
    // show for it.
    if (paymentIntentId !== null) {
      await stripe.refunds.create({ payment_intent: paymentIntentId }).catch((refundError) => {
        console.error(
          `modifyBookingWithFee: DB transaction failed AND the compensating refund also failed for PaymentIntent ${paymentIntentId}. Manual reconciliation required.`,
          refundError
        );
      });
    }
    throw error;
  }
}
