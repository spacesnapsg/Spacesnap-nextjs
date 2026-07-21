// Cancellation-window refund/penalty policy for the merchant-of-record,
// direct-charge booking model.
//
// Split out of lib/booking-payments.ts (2026-07-21, Cancel/Modify Booking UI
// session): these calculators are pure and Prisma-free, but booking-payments
// imports the generated Prisma client for its SupplierTier→InvoicingCadence
// mapping, which must not be pulled into the browser bundle. The Cancel/
// Modify modals import THIS module to preview refund/fee tiers client-side —
// the same functions the server routes execute, so the preview can't drift
// from the charge. booking-payments re-exports everything here, so
// server-side imports and tests are unchanged.
//
// Confirmed with the product owner (2026-07-21, correcting this file's
// original unconfirmed assumption — see CLAUDE1.md): whichever party did NOT
// cause the cancellation is made whole, so each function below is only ever
// applied to the AT-FAULT party's own side of a cancellation, never both:
//   - calculateUserCancellationRefund is used when the USER cancels (their
//     own refund follows the day tier below).
//   - calculateSupplierCancellationPenalty is used when the SUPPLIER
//     declines (their penalty, sized against SpaceSnap's commission portion
//     of the booking — not the full sgdAmount — follows the day tier below).
// A caller must never apply the "wrong" function to a cancellation it didn't
// cause (e.g. penalizing the supplier for a user-initiated cancel) — see
// lib/bookings.ts's declineBookingWithRefund (supplier-caused: 100% user
// refund + day-tier supplier penalty) vs cancelBookingWithRefund
// (user-caused: day-tier user refund + zero supplier penalty).
//
// Day tiers (calendar-day count, both dates normalized to UTC midnight
// before diffing — Booking.startDate is already a date-only column, so this
// avoids the cancellation timestamp's time-of-day shifting which tier a
// same-calendar-day cancellation lands in):
//   >= 7 days before session start      -> 100% / 0%
//   3-6 days before session start       -> 50%  / 50%
//   < 3 days before (incl. after start) -> 0%   / 100%

export interface CancellableBooking {
  startDate: Date | string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMidnight(value: Date | string): number {
  const d = value instanceof Date ? value : new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function daysBeforeSessionStart(booking: CancellableBooking, cancelledAt: Date): number {
  const startMidnight = toUtcMidnight(booking.startDate);
  const cancelledMidnight = toUtcMidnight(cancelledAt);
  return Math.floor((startMidnight - cancelledMidnight) / MS_PER_DAY);
}

// The percent of what the user paid that they get back, when THEY cancel.
export function calculateUserCancellationRefund(booking: CancellableBooking, cancelledAt: Date): number {
  const daysBefore = daysBeforeSessionStart(booking, cancelledAt);
  if (daysBefore >= 7) return 100;
  if (daysBefore >= 3) return 50;
  return 0;
}

// The percent of SpaceSnap's commission portion the supplier forfeits, when
// THEY decline. Mirrors the user function's tiers with inverted percentages
// (the supplier is penalized more the later they cancel, same
// day-before-start basis).
export function calculateSupplierCancellationPenalty(booking: CancellableBooking, cancelledAt: Date): number {
  const daysBefore = daysBeforeSessionStart(booking, cancelledAt);
  if (daysBefore >= 7) return 0;
  if (daysBefore >= 3) return 50;
  return 100;
}

// Flat platform commission for space/equipment bookings, confirmed with the
// product owner 2026-07-21. Snapshotted onto Booking.platformCommissionPercent
// at creation time (see createBookingWithDebit, lib/bookings.ts) rather than
// read live at cancellation time, so a future rate change can't reshuffle an
// already-created booking's numbers. Consumables/bulk orders use a different,
// separately-scoped commission rate — not this constant.
export const PLATFORM_COMMISSION_PERCENT_BOOKINGS = 10;

// Sprint 4.75 addition (2026-07-21) — "Modify Booking" (reschedule) eligibility
// and fee/cap engine, per the product brief's own pseudocode. Standalone/pure,
// same "unit-testable without a DB" pattern as the cancellation calculators
// above — lib/bookings.ts's modifyBookingWithFee is the only caller that
// touches Prisma/Stripe.
//
// Day tiers are notice BEFORE the booking's CURRENT (pre-this-modification)
// start date, calendar-day count, same UTC-midnight normalization as
// daysBeforeSessionStart above:
//   >  7 days notice  -> free, no fee, max_refundable_percent reset to 100
//   3-7 days notice   -> 20% fee (of the booking's sgd_amount), charged
//                        immediately; max_refundable_percent reset to 50
//   <  3 days notice  -> rejected outright (not eligible)
//
// Note the boundary at exactly day 7 is deliberately NOT the same tier as
// calculateUserCancellationRefund's day-7 boundary (that one is >=7 for the
// top tier) — this is what the brief's own boundary conditions ("> 7" free vs
// "3 <= Days <= 7" fee) specify, not a copy-paste of the cancellation tiers.
export const MODIFICATION_FEE_PERCENT = 20;
const MODIFICATION_FREE_MIN_NOTICE_DAYS = 7; // strictly greater than this
const MODIFICATION_MIN_NOTICE_DAYS = 3; // below this, rejected

export type ModificationEligibility =
  | { eligible: true; noticeDays: number; feePercent: number; maxRefundablePercent: number }
  | { eligible: false; noticeDays: number };

export function calculateModificationTerms(booking: CancellableBooking, requestedAt: Date): ModificationEligibility {
  const noticeDays = daysBeforeSessionStart(booking, requestedAt);

  if (noticeDays > MODIFICATION_FREE_MIN_NOTICE_DAYS) {
    return { eligible: true, noticeDays, feePercent: 0, maxRefundablePercent: 100 };
  }
  if (noticeDays >= MODIFICATION_MIN_NOTICE_DAYS) {
    return { eligible: true, noticeDays, feePercent: MODIFICATION_FEE_PERCENT, maxRefundablePercent: 50 };
  }
  return { eligible: false, noticeDays };
}

// The "Refund Cap Engine" — a booking that was previously modified may carry
// a maxRefundablePercent cap (Booking.maxRefundablePercent) below the
// standard day-tier refund a cancellation would otherwise pay out.
// `cap === null` means uncapped (a never-modified booking), so this is a
// no-op for every booking this feature hasn't touched.
export function applyRefundCap(standardRefundPercent: number, cap: number | null): number {
  return cap === null ? standardRefundPercent : Math.min(standardRefundPercent, cap);
}
