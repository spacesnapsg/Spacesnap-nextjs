import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { payoutCadenceForSupplierTier } from "@/lib/booking-payments";
import { getCompanySupplierTier } from "@/lib/supplier-tiers";
import { sgdToCredits } from "@/lib/credit-units";
import { supplierGrossForBase, supplierGrossForConsumable, getEffectiveCompanyPricing } from "@/lib/pricing";

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

// The three-way money reconciliation (financial audit F2 Part D) over any set
// of SupplierPayable rows — the whole point of persisting commissionAmount.
// All figures derive from stored columns, no re-join to bookings/sales:
//   supplierNet    = SUM(netAmount)                    (what the supplier is paid)
//   commissionKept = SUM(commissionAmount + penaltyDeduction)  (SpaceSnap's cut,
//                    incl. decline penalties, which are also SpaceSnap income)
//   grossCollected = commissionKept + supplierNet      (what members paid, net
//                    of refunds — a refunded booking's payable is a zero/penalty
//                    row, so it contributes only the penalty, not the refund)
// The identity grossCollected == commissionKept + supplierNet holds by
// construction, per row and summed, which is exactly what makes it auditable.
export interface PayableReconciliation {
  grossCollected: Prisma.Decimal;
  commissionKept: Prisma.Decimal;
  supplierNet: Prisma.Decimal;
}

export async function getPayableReconciliation(
  where: Prisma.SupplierPayableWhereInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PayableReconciliation> {
  const r = await client.supplierPayable.aggregate({
    where,
    _sum: { netAmount: true, commissionAmount: true, penaltyDeduction: true },
  });
  const zero = new Prisma.Decimal(0);
  const supplierNet = r._sum.netAmount ?? zero;
  const commissionKept = (r._sum.commissionAmount ?? zero).add(r._sum.penaltyDeduction ?? zero);
  return { grossCollected: commissionKept.add(supplierNet), commissionKept, supplierNet };
}

// Every dollar that has flowed through the payable ledger, all-time and all
// statuses — the platform-wide reconciliation headline on the admin panel.
export async function getPlatformReconciliation(): Promise<PayableReconciliation> {
  return getPayableReconciliation({});
}

// Same reconciliation for many payout batches at once (one groupBy, not N),
// keyed by payoutId string — for the "Awaiting Payment" and supplier-history
// batch rows.
export async function getReconciliationByPayoutIds(payoutIds: bigint[]): Promise<Map<string, PayableReconciliation>> {
  const result = new Map<string, PayableReconciliation>();
  if (payoutIds.length === 0) return result;
  const grouped = await prisma.supplierPayable.groupBy({
    by: ["payoutId"],
    where: { payoutId: { in: payoutIds } },
    _sum: { netAmount: true, commissionAmount: true, penaltyDeduction: true },
  });
  const zero = new Prisma.Decimal(0);
  for (const g of grouped) {
    if (g.payoutId === null) continue;
    const supplierNet = g._sum.netAmount ?? zero;
    const commissionKept = (g._sum.commissionAmount ?? zero).add(g._sum.penaltyDeduction ?? zero);
    result.set(g.payoutId.toString(), { grossCollected: commissionKept.add(supplierNet), commissionKept, supplierNet });
  }
  return result;
}

export function serializeReconciliation(r: PayableReconciliation) {
  return {
    grossCollected: sgdToCredits(Number(r.grossCollected)),
    commissionKept: sgdToCredits(Number(r.commissionKept)),
    supplierNet: sgdToCredits(Number(r.supplierNet)),
  };
}

export interface CompanyRevenueBreakdown {
  companyId: string;
  companyName: string;
  gross: number;
  markup: number;
  commission: number;
  supplierNet: number;
}

const revenueBreakdownPayableInclude = {
  booking: { select: { sgdAmount: true, baseAmount: true } },
} satisfies Prisma.SupplierPayableInclude;

// System-admin "Revenue by Operator" table (financial audit F5) — a further
// decomposition of getPayableReconciliation's commissionKept into pure
// Markup vs pure Commission, per company. Recognized at COMPLETION (this
// same SupplierPayable ledger), not at charge time — supersedes the old
// Transaction-based getRevenueByCompany (lib/revenue.ts), which recognized
// revenue the moment a member was charged, before a booking necessarily
// completed.
//
// Prisma can't aggregate/groupBy across a relation join (booking.sgdAmount/
// baseAmount), so this fetches every payable + its booking and reduces in
// JS — same idiom getRevenueByCompany used for its own cross-relation sum.
//
// Per row: supplierNet = netAmount (always). penaltyDeduction always folds
// into commission (it's platform income on a decline, same as
// getPayableReconciliation's commissionKept). Markup only exists for a
// NORMAL booking completion (booking set AND commissionAmount > 0) — a
// decline/cancel row leaves commissionAmount at 0 by construction, so it can
// never be misattributed as markup even though its original booking's
// sgdAmount/baseAmount are still nonzero. Consumables have no markup by
// definition (supplierGrossForConsumable is a pure percentage split), so
// their whole commissionAmount is pure commission.
//
// Worked examples (lib/supplier-payables.test.ts): base 100 @ 50%
// markup/10% commission → markup 50, commission 10, supplierNet 90, gross
// 150. Consumable RSP 100 @ 7% → markup 0, commission 7, supplierNet 93,
// gross 100. Identity preserved in every case: gross == markup + commission
// + supplierNet (mirrors getPayableReconciliation's grossCollected ==
// commissionKept + supplierNet, one level more granular).
export async function getCompanyRevenueBreakdown(): Promise<CompanyRevenueBreakdown[]> {
  const [companies, payables] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplierPayable.findMany({ include: revenueBreakdownPayableInclude }),
  ]);

  const zero = new Prisma.Decimal(0);
  const totals = new Map<string, { markup: Prisma.Decimal; commission: Prisma.Decimal; supplierNet: Prisma.Decimal }>();

  for (const p of payables) {
    const key = p.companyId.toString();
    const acc = totals.get(key) ?? { markup: zero, commission: zero, supplierNet: zero };

    let markup = zero;
    let commission = p.penaltyDeduction;
    if (p.booking && p.commissionAmount.gt(0)) {
      markup = p.booking.sgdAmount.sub(p.booking.baseAmount);
      commission = commission.add(p.commissionAmount.sub(markup));
    } else {
      commission = commission.add(p.commissionAmount);
    }

    totals.set(key, {
      markup: acc.markup.add(markup),
      commission: acc.commission.add(commission),
      supplierNet: acc.supplierNet.add(p.netAmount),
    });
  }

  return companies.map((c) => {
    const t = totals.get(c.id.toString()) ?? { markup: zero, commission: zero, supplierNet: zero };
    const gross = t.markup.add(t.commission).add(t.supplierNet);
    return {
      companyId: c.id.toString(),
      companyName: c.name,
      gross: sgdToCredits(Number(gross)),
      markup: sgdToCredits(Number(t.markup)),
      commission: sgdToCredits(Number(t.commission)),
      supplierNet: sgdToCredits(Number(t.supplierNet)),
    };
  });
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

  // The supplier is paid (100 - commission)% of their BASE price; SpaceSnap's
  // cut is everything else the member paid (the markup + commission% of base).
  const grossAmount = supplierGrossForBase(booking.baseAmount, booking.platformCommissionPercent);
  const commissionAmount = booking.sgdAmount.sub(grossAmount).toDecimalPlaces(2);
  const { tier } = await getCompanySupplierTier(booking.listing.companyId, tx);

  await tx.supplierPayable.create({
    data: {
      companyId: booking.listing.companyId,
      bookingId: booking.id,
      grossAmount,
      commissionAmount,
      penaltyDeduction: new Prisma.Decimal(0),
      netAmount: grossAmount,
      payoutCadence: payoutCadenceForSupplierTier(tier),
    },
  });
}

// Written when a consumable sale settles — a completed Buy Now purchase
// (createPurchaseWithDebit) or a fulfilled bulk order (fulfillBulkOrderWithDebit),
// both terminal states with no cancellation/reversal afterward (unlike a
// booking), so there is never a decline-penalty or zero-effect variant here.
// The member pays the RSP (no markup on consumables); the supplier keeps
// (100 - consumables commission)% of it, SpaceSnap the rest. Snapshots the
// effective consumables commission at settlement time, same discipline as the
// booking path. `chargedSgd` is the full sale amount (RSP × qty) — a
// reward-discount the buyer redeemed is SpaceSnap-funded and does not reduce
// the supplier's share, exactly as with bookings (see Booking.baseAmount).
export async function createConsumablePayable(
  tx: Prisma.TransactionClient,
  params: { companyId: bigint; chargedSgd: Prisma.Decimal } & (
    | { purchaseId: bigint; bulkOrderRequestId?: undefined }
    | { bulkOrderRequestId: bigint; purchaseId?: undefined }
  )
): Promise<void> {
  const pricing = await getEffectiveCompanyPricing(params.companyId, tx);
  const grossAmount = supplierGrossForConsumable(params.chargedSgd, pricing.consumablesCommissionPercent);
  const commissionAmount = params.chargedSgd.sub(grossAmount).toDecimalPlaces(2);
  const { tier } = await getCompanySupplierTier(params.companyId, tx);

  await tx.supplierPayable.create({
    data: {
      companyId: params.companyId,
      purchaseId: params.purchaseId,
      bulkOrderRequestId: params.bulkOrderRequestId,
      grossAmount,
      commissionAmount,
      penaltyDeduction: new Prisma.Decimal(0),
      netAmount: grossAmount,
      payoutCadence: payoutCadenceForSupplierTier(tier),
    },
  });
}
