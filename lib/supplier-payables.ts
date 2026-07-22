import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { invoicingCadenceForSupplierTier } from "@/lib/booking-payments";
import { getCompanySupplierTier } from "@/lib/supplier-tiers";

// Live-computed, never stored denormalized — same "SUM over the ledger"
// principle as getCreditBalance (lib/credits.ts). A company's pending
// payable balance is the sum of every pending SupplierPayable row: normal
// booking-completion credits (createCompletedBookingPayable below) and
// supplier-cancellation-penalty debits (declineBookingPendingResolution,
// lib/bookings.ts) net together automatically here — a penalty from one
// booking is absorbed by earnings from others without any explicit "check
// the balance, then deduct" step, the same way a Transaction ledger SUM
// already reflects a spend against a prior top-up. Can go negative (the
// supplier owes SpaceSnap back) when penalties exceed pending earnings;
// recovering a negative balance is an invoicing/collection process, not
// built here — still the open Sprint 6 Invoice/Receipt gap.
export async function getSupplierPendingPayableBalance(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const result = await client.supplierPayable.aggregate({
    where: { companyId, status: "pending" },
    _sum: { netAmount: true },
  });
  return result._sum.netAmount ?? new Prisma.Decimal(0);
}

// Written once a booking's service is actually rendered — check-out flips
// active -> completed (checkOutCheckIn, lib/check-ins.ts) — never for a
// cancelled/declined booking, since that money was refunded to the user
// instead of earned by anyone. grossAmount = sgdAmount minus the platform's
// flat commission (Booking.platformCommissionPercent, snapshotted at
// booking creation); no penalty applies to a normal completion.
export async function createCompletedBookingPayable(tx: Prisma.TransactionClient, bookingId: bigint): Promise<void> {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { listing: true },
  });

  const commissionAmount = booking.sgdAmount.mul(booking.platformCommissionPercent).div(100).toDecimalPlaces(2);
  const grossAmount = booking.sgdAmount.sub(commissionAmount);
  const { tier } = await getCompanySupplierTier(booking.listing.companyId, tx);

  await tx.supplierPayable.create({
    data: {
      companyId: booking.listing.companyId,
      bookingId: booking.id,
      grossAmount,
      penaltyDeduction: new Prisma.Decimal(0),
      netAmount: grossAmount,
      invoicingCadence: invoicingCadenceForSupplierTier(tier),
    },
  });
}
