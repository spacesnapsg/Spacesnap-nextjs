import { Prisma, SupplierPayoutStatus, type SupplierPayout } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sgdToCredits } from "@/lib/credit-units";
import { ApiValidationError } from "@/lib/api-errors";
import { getReconciliationByPayoutIds, serializeReconciliation } from "@/lib/supplier-payables";

export class SupplierPayoutError extends Error {
  constructor(public readonly reason: "not_found" | "not_billed" | "no_pending_payables") {
    super(
      reason === "not_found"
        ? "This payout does not exist."
        : reason === "not_billed"
          ? "This payout has already been paid."
          : "This company has no pending payables in the selected period."
    );
  }
}

function parseUrlOrNull(raw: unknown, field: string, errors: Record<string, string[]>): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") {
    errors[field] = [`${field} must be a string.`];
    return null;
  }
  const trimmed = raw.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    errors[field] = [`${field} must be a valid URL.`];
    return null;
  }
}

function parseDateOnly(raw: unknown, field: string, errors: Record<string, string[]>): Date | null {
  if (typeof raw !== "string" || !raw) {
    errors[field] = [`${field} is required.`];
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors[field] = [`${field} must be a valid date.`];
    return null;
  }
  return parsed;
}

// Admin-only. Companies with at least one un-batched SupplierPayable
// (status pending) — the "Ready to Bill" side of the Supplier Payouts card
// on the admin Financials page. Grouped/summed live (same "SUM over the
// ledger" discipline as getSupplierPendingPayableBalance) since a pending
// row can be added at any moment right up until an admin sweeps it into a
// batch.
export async function listCompaniesWithPendingPayables() {
  const grouped = await prisma.supplierPayable.groupBy({
    by: ["companyId"],
    where: { status: "pending" },
    _sum: { netAmount: true, commissionAmount: true, penaltyDeduction: true },
    _min: { createdAt: true },
  });

  if (grouped.length === 0) return [];

  const companies = await prisma.company.findMany({
    where: { id: { in: grouped.map((g) => g.companyId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(companies.map((c) => [c.id.toString(), c.name]));

  return grouped
    .map((g) => {
      // Reconciliation so an admin can verify the split BEFORE closing the
      // period + creating the Xero Bill (grossCollected = commissionKept +
      // supplierNet; commissionKept folds in decline penalties).
      const supplierNet = Number(g._sum.netAmount ?? 0);
      const commissionKept = Number(g._sum.commissionAmount ?? 0) + Number(g._sum.penaltyDeduction ?? 0);
      return {
        companyId: g.companyId.toString(),
        companyName: nameById.get(g.companyId.toString()) ?? "Unknown company",
        pendingTotal: sgdToCredits(supplierNet),
        commissionKept: sgdToCredits(commissionKept),
        grossCollected: sgdToCredits(commissionKept + supplierNet),
        oldestPendingSince: g._min.createdAt ? g._min.createdAt.toISOString() : null,
      };
    })
    .sort((a, b) => b.pendingTotal - a.pendingTotal);
}

// Admin-only. Batches already billed (a Bill exists in Xero, or is expected
// to) but not yet confirmed paid — the "Awaiting Payment" side of the same
// card.
export async function listPayoutsAwaitingPayment() {
  const payouts = await prisma.supplierPayout.findMany({
    where: { status: "billed" },
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const reconciliation = await getReconciliationByPayoutIds(payouts.map((p) => p.id));
  return payouts.map((p) => ({
    ...serializeAdminSupplierPayout(p),
    reconciliation: serializeReconciliation(
      reconciliation.get(p.id.toString()) ?? {
        grossCollected: new Prisma.Decimal(0),
        commissionKept: new Prisma.Decimal(0),
        supplierNet: new Prisma.Decimal(0),
      }
    ),
  }));
}

export function serializeAdminSupplierPayout(p: SupplierPayout & { company: { name: string } }) {
  return {
    ...serializeSupplierPayout(p),
    companyName: p.company.name,
  };
}

export function serializeSupplierPayout(p: SupplierPayout) {
  return {
    id: p.id.toString(),
    periodStart: p.periodStart.toISOString().slice(0, 10),
    periodEnd: p.periodEnd.toISOString().slice(0, 10),
    totalAmount: sgdToCredits(Number(p.totalAmount)),
    status: p.status,
    xeroBillUrl: p.xeroBillUrl,
    xeroRemittanceUrl: p.xeroRemittanceUrl,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

// Admin-only. Closes a payout period for one company: sweeps every pending
// SupplierPayable created within [periodStart, periodEnd] into a new
// SupplierPayout batch (pending -> scheduled), snapshotting their summed
// netAmount as the batch total. No live Xero connection exists yet (no
// Xero Developer app registered as of 2026-07-24) — xeroBillUrl is a
// manually-pasted reference, filled in now or later via
// setSupplierPayoutBillUrl once the admin has the real Xero Bill link.
export async function createSupplierPayout(input: Record<string, unknown>): Promise<SupplierPayout> {
  const errors: Record<string, string[]> = {};

  let companyId: bigint | null = null;
  try {
    companyId = BigInt(String(input.companyId));
  } catch {
    errors.companyId = ["companyId must be a valid company id."];
  }

  const periodStart = parseDateOnly(input.periodStart, "periodStart", errors);
  const periodEnd = parseDateOnly(input.periodEnd, "periodEnd", errors);
  if (periodStart && periodEnd && periodStart > periodEnd) {
    errors.periodStart = [...(errors.periodStart ?? []), "periodStart must not be after periodEnd."];
  }
  const xeroBillUrl = parseUrlOrNull(input.xeroBillUrl, "xeroBillUrl", errors);

  if (Object.keys(errors).length > 0) throw new ApiValidationError(errors);

  // periodEnd is a bare date — extend through end-of-day so a payable
  // created any time on the end date is still swept in, same "through the
  // end of that day" convention as parseActivityQuery's `to`.
  const periodEndInclusive = new Date(periodEnd!);
  periodEndInclusive.setHours(23, 59, 59, 999);

  return prisma.$transaction(async (tx) => {
    const pending = await tx.supplierPayable.findMany({
      where: {
        companyId: companyId!,
        status: "pending",
        createdAt: { gte: periodStart!, lte: periodEndInclusive },
      },
    });

    if (pending.length === 0) throw new SupplierPayoutError("no_pending_payables");

    const totalAmount = pending.reduce((sum, p) => sum.add(p.netAmount), new Prisma.Decimal(0));

    const payout = await tx.supplierPayout.create({
      data: {
        companyId: companyId!,
        periodStart: periodStart!,
        periodEnd: periodEnd!,
        totalAmount,
        xeroBillUrl,
      },
    });

    await tx.supplierPayable.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: "scheduled", payoutId: payout.id },
    });

    return payout;
  });
}

// Admin-only. Attaches/updates the Xero Bill URL on an already-billed
// payout — covers the case where an admin closes a period before Xero has
// actually generated the Bill document yet, then comes back to paste the
// link once it exists.
export async function setSupplierPayoutBillUrl(id: bigint, xeroBillUrl: unknown): Promise<SupplierPayout> {
  const errors: Record<string, string[]> = {};
  const url = parseUrlOrNull(xeroBillUrl, "xeroBillUrl", errors);
  if (!url) errors.xeroBillUrl = errors.xeroBillUrl ?? ["xeroBillUrl is required."];
  if (Object.keys(errors).length > 0) throw new ApiValidationError(errors);

  const result = await prisma.supplierPayout.updateMany({
    where: { id, status: "billed" },
    data: { xeroBillUrl: url },
  });
  if (result.count === 0) {
    const existing = await prisma.supplierPayout.findUnique({ where: { id } });
    throw new SupplierPayoutError(existing ? "not_billed" : "not_found");
  }
  return prisma.supplierPayout.findUniqueOrThrow({ where: { id } });
}

// Admin-only. Confirms a batch's payout actually transferred — flips the
// SupplierPayout and every SupplierPayable swept into it from
// scheduled/billed to paid, and attaches the Xero Remittance Advice link
// the supplier can self-serve from their own Financials card.
export async function markSupplierPayoutPaid(id: bigint, xeroRemittanceUrl: unknown): Promise<SupplierPayout> {
  const errors: Record<string, string[]> = {};
  const url = parseUrlOrNull(xeroRemittanceUrl, "xeroRemittanceUrl", errors);
  if (!url) errors.xeroRemittanceUrl = errors.xeroRemittanceUrl ?? ["xeroRemittanceUrl is required."];
  if (Object.keys(errors).length > 0) throw new ApiValidationError(errors);

  return prisma.$transaction(async (tx) => {
    const result = await tx.supplierPayout.updateMany({
      where: { id, status: "billed" },
      data: { status: SupplierPayoutStatus.paid, paidAt: new Date(), xeroRemittanceUrl: url },
    });
    if (result.count === 0) {
      const existing = await tx.supplierPayout.findUnique({ where: { id } });
      throw new SupplierPayoutError(existing ? "not_billed" : "not_found");
    }

    await tx.supplierPayable.updateMany({
      where: { payoutId: id, status: "scheduled" },
      data: { status: "paid" },
    });

    return tx.supplierPayout.findUniqueOrThrow({ where: { id } });
  });
}

// Supplier-facing. The caller's own company's full payout history — backs
// the Financials page's "Accounts Receivable, Receipts & Invoices" card.
// Bounded by nature (one row per payout cadence, ~26/year at biweekly), so
// no pagination — same reasoning as why the Purchased/Earned Credits cards
// above it don't paginate either.
export async function listSupplierPayoutsForCompany(companyId: bigint) {
  const payouts = await prisma.supplierPayout.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return payouts.map(serializeSupplierPayout);
}
