import { InvoicingCadence } from "@/app/generated/prisma/client";
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

// Snapshot of the live-computed supplier tier's cadence (lib/supplier-tiers.ts)
// AT SupplierPayable-creation time (see SupplierPayable.invoicingCadence's
// own schema comment for why this is a snapshot, not a live join). Confirmed
// with the product owner 2026-07-21.
const SUPPLIER_TIER_INVOICING_CADENCE: Record<SupplierTier, InvoicingCadence> = {
  free: InvoicingCadence.monthly,
  preferred: InvoicingCadence.biweekly,
  top: InvoicingCadence.weekly,
};

export function invoicingCadenceForSupplierTier(tier: SupplierTier): InvoicingCadence {
  return SUPPLIER_TIER_INVOICING_CADENCE[tier];
}
