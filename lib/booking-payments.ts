import { PayoutCadence } from "@/app/generated/prisma/client";
import type { SupplierTier } from "@/lib/supplier-tiers";

// The pure refund/fee/cap calculators moved to lib/booking-policy.ts
// (2026-07-21, Cancel/Modify Booking UI session) so the browser-side preview
// in the Cancel/Modify modals can import them without dragging the generated
// Prisma client (needed below for the tier→cadence mapping) into the client
// bundle. Re-exported here so every existing server-side import and test
// keeps working unchanged — server code should keep importing from this
// module.
export {
  type CancellableBooking,
  type ModificationEligibility,
  daysBeforeSessionStart,
  calculateUserCancellationRefund,
  calculateSupplierCancellationPenalty,
  calculateModificationTerms,
  applyRefundCap,
  PLATFORM_COMMISSION_PERCENT_BOOKINGS,
  MODIFICATION_FEE_PERCENT,
} from "@/lib/booking-policy";

// Snapshot of the live-computed supplier tier's payout cadence
// (lib/supplier-tiers.ts) AT SupplierPayable-creation time (see
// SupplierPayable.payoutCadence's own schema comment for why this is a
// snapshot, not a live join). Originally tier-differentiated
// (monthly/biweekly/weekly), confirmed with the product owner 2026-07-21;
// flattened to biweekly for every tier per the product owner's 2026-07-23
// correction (no more monthly cadence, tier no longer affects payout
// frequency — only the rebate % does). Renamed from
// InvoicingCadence/invoicingCadenceForSupplierTier the same day — this is
// SpaceSnap paying OUT to the supplier on this cadence, not the supplier
// invoicing SpaceSnap. PayoutCadence.monthly/weekly stay in the Prisma enum
// unchanged since existing SupplierPayable rows snapshotted from before this
// change may still hold them.
const SUPPLIER_TIER_PAYOUT_CADENCE: Record<SupplierTier, PayoutCadence> = {
  free: PayoutCadence.biweekly,
  preferred: PayoutCadence.biweekly,
  top: PayoutCadence.biweekly,
};

export function payoutCadenceForSupplierTier(tier: SupplierTier): PayoutCadence {
  return SUPPLIER_TIER_PAYOUT_CADENCE[tier];
}
