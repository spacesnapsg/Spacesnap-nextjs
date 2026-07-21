import { SupplierTier, InvoicingCadence } from "@/app/generated/prisma/client";

// Cancellation-window refund/penalty policy for the merchant-of-record,
// direct-charge booking model.
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

// Snapshot of Company.supplierTier's cadence AT SupplierPayable-creation time
// (see SupplierPayable.invoicingCadence's own schema comment for why this is
// a snapshot, not a live join). Confirmed with the product owner 2026-07-21.
const SUPPLIER_TIER_INVOICING_CADENCE: Record<SupplierTier, InvoicingCadence> = {
  free: InvoicingCadence.monthly,
  preferred: InvoicingCadence.biweekly,
  top: InvoicingCadence.weekly,
};

export function invoicingCadenceForSupplierTier(tier: SupplierTier): InvoicingCadence {
  return SUPPLIER_TIER_INVOICING_CADENCE[tier];
}
