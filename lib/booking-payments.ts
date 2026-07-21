// Cancellation-window refund/penalty policy for the merchant-of-record,
// direct-charge booking model (2026-07-21 schema session — see
// Booking.userRefundPercent/supplierPenaltyPercent in schema.prisma).
//
// ASSUMPTION, not confirmed with the product owner — flagging per this
// project's "state a read, don't silently guess" convention (see CLAUDE1.md's
// tier-comparison-scrapped correction for why this matters): no cancellation-
// window policy exists anywhere in this codebase or the old Laravel build
// (grepped both, zero hits). This session's own brief names three boundary
// days to test — day 7, day 3, day 0 — which imply the step function used
// below:
//   >= 7 days before session start      -> 100% user refund / 0%  supplier penalty
//   3-6 days before session start       -> 50%  user refund / 50% supplier penalty
//   < 3 days before (incl. after start) -> 0%   user refund / 100% supplier penalty
// Confirm this exact policy with the product owner before any future session
// wires it into a real cancellation route — nothing here is called by any
// route yet, this session only adds the pure calculators + schema columns
// they populate.
//
// "Days before" is a calendar-day count (both dates normalized to UTC
// midnight before diffing), not a raw ms/24h division — Booking.startDate is
// already stored as a date-only column (@db.Date), so this avoids the
// cancellation timestamp's time-of-day shifting which tier a same-calendar-
// day cancellation lands in (e.g. cancelling at 11pm 7 calendar days out
// should land in the same tier as cancelling at 6am that same day).
//
// Standalone/pure, no Prisma/DB dependency — same "unit-testable without a
// DB" pattern as lib/certificate-gating.ts.

export interface CancellableBooking {
  startDate: Date | string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMidnight(value: Date | string): number {
  const d = value instanceof Date ? value : new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysBeforeSessionStart(booking: CancellableBooking, cancelledAt: Date): number {
  const startMidnight = toUtcMidnight(booking.startDate);
  const cancelledMidnight = toUtcMidnight(cancelledAt);
  return Math.floor((startMidnight - cancelledMidnight) / MS_PER_DAY);
}

// Returns the percent of the Stripe charge the USER gets back when THEY
// cancel, based on days-before-session-start at cancellation time.
export function calculateUserCancellationRefund(booking: CancellableBooking, cancelledAt: Date): number {
  const daysBefore = daysBeforeSessionStart(booking, cancelledAt);
  if (daysBefore >= 7) return 100;
  if (daysBefore >= 3) return 50;
  return 0;
}

// Mirrors calculateUserCancellationRefund's day tiers with inverted
// percentages (the supplier is penalized more the later they cancel, same
// day-before-start basis). The returned percent applies against SpaceSnap's
// commission portion of the booking, NOT the full sgdAmount — no commission-
// rate figure exists anywhere in this schema yet (grepped; a real, separate
// gap — see SPRINT_PLAN_NEXTJS_REWRITE.md's Sprint 6 "platform fee... scope
// TBD" note), so this function only returns the percent tier, same as the
// user-side function above. Resolving this percent against an actual
// commission dollar amount is left to whatever future session builds
// SupplierPayable's write path.
export function calculateSupplierCancellationPenalty(booking: CancellableBooking, cancelledAt: Date): number {
  const daysBefore = daysBeforeSessionStart(booking, cancelledAt);
  if (daysBefore >= 7) return 0;
  if (daysBefore >= 3) return 50;
  return 100;
}
