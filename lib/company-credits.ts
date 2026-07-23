import { Prisma, CompanyTransactionType, type CompanyTransaction } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { creditsToSgd, sgdToCredits } from "@/lib/credit-units";
import { InsufficientCreditBalanceError } from "@/lib/credits";
import { getCompanySupplierTier, type SupplierTier } from "@/lib/supplier-tiers";
import type { ActivityQuery } from "@/lib/activity";

// A per-COMPANY credit ledger — see CompanyTransaction's own schema comment
// for why this is a separate table from the per-user Transaction ledger
// (lib/credits.ts), not a companyId column bolted onto it. Same "live SUM,
// never denormalized" principle as getCreditBalance/
// getSupplierPendingPayableBalance/getUserRewardTier.
//
// Includes purchased_spend (Sprint 6.12, Bumps/Pins) alongside
// purchased_topup — mirrors getPurchasedBalance's own type list
// (lib/credits.ts) exactly; purchased_spend rows are written with a
// negative amount (see purchaseBumps below), so summing both types in one
// aggregate is correct, not a double-count.
export async function getCompanyPurchasedBalance(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const agg = await client.companyTransaction.aggregate({
    where: { companyId, type: { in: [CompanyTransactionType.purchased_topup, CompanyTransactionType.purchased_spend] } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

export async function getCompanyEarnedBalance(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const agg = await client.companyTransaction.aggregate({
    where: { companyId, type: { in: [CompanyTransactionType.earned_rebate, CompanyTransactionType.earned_spend] } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

// earned-balance counterpart to lib/credits.ts's assertSufficientEarnedBalance,
// scoped to a company instead of a user. First caller: the Supplier Rewards
// Catalogue redemption (lib/supplier-reward-redemptions.ts).
export async function assertSufficientCompanyEarnedBalance(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  cost: Prisma.Decimal
): Promise<void> {
  const balance = await getCompanyEarnedBalance(companyId, tx);
  if (balance.lt(cost)) {
    throw new InsufficientCreditBalanceError(balance, cost);
  }
}

export function parseCompanyTopUpAmount(body: unknown): Prisma.Decimal {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) {
    throw new ApiValidationError({ amount: ["amount must be a positive number."] });
  }

  // Entered in "credits" — converted to true SGD once here, at the write
  // boundary (see lib/credit-units.ts), same discipline as the per-user
  // wallet top-up (parseTopUpFields, lib/wallet.ts).
  const amount = new Prisma.Decimal(creditsToSgd(b.amount)).toDecimalPlaces(2);
  if (amount.lte(0)) {
    throw new ApiValidationError({ amount: ["amount must be a positive number."] });
  }
  return amount;
}

// Any company member can top up (confirmed with the product owner — no
// isCompanyAdmin-only gate). Credits-only for now, same posture as the
// per-user wallet top-up (createTopUp, lib/wallet.ts) — no real Stripe
// charge backs this yet.
export async function createCompanyTopUp(
  companyId: bigint,
  userId: string,
  amount: Prisma.Decimal
): Promise<{ transaction: CompanyTransaction; balance: Prisma.Decimal }> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.companyTransaction.create({
      data: {
        companyId,
        userId,
        type: CompanyTransactionType.purchased_topup,
        amount,
        description: "Company wallet top-up",
      },
    });

    const balance = await getCompanyPurchasedBalance(companyId, tx);
    return { transaction, balance };
  });
}

// Rebate % per the company's own live-computed supplier tier
// (lib/supplier-tiers.ts) — corrected 2026-07-23 to the product owner's own
// confirmed numbers, sourced from the updated
// public/rewards/supplier-reward-tiers-infographic.png (1%/1.2%/1.5%).
// Previously an unconfirmed inference (1%/1.5%/2%) flagged per this
// codebase's "confirm major decisions, flag minor numeric choices"
// convention — now resolved, don't let this drift from that image again
// without updating both together.
const COMPANY_REBATE_PERCENT: Record<SupplierTier, number> = {
  free: 1,
  preferred: 1.2,
  top: 1.5,
};

// Written once a booking's service is actually rendered (checkOutCheckIn,
// lib/check-ins.ts), alongside createCompletedBookingPayable/
// grantRewardTierRebate — same trigger point, same "only a genuinely
// completed booking pays out anything" discipline. A cancelled/declined
// booking never reaches this path, so it never earns a rebate either.
export async function grantCompanyBookingRebate(tx: Prisma.TransactionClient, bookingId: bigint): Promise<void> {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { listing: true },
  });

  const { tier } = await getCompanySupplierTier(booking.listing.companyId, tx);
  const rebatePercent = COMPANY_REBATE_PERCENT[tier];
  const rebateAmount = booking.sgdAmount.mul(rebatePercent).div(100).toDecimalPlaces(2);

  if (rebateAmount.lte(0)) return;

  await tx.companyTransaction.create({
    data: {
      companyId: booking.listing.companyId,
      bookingId: booking.id,
      type: CompanyTransactionType.earned_rebate,
      amount: rebateAmount,
      description: `Booking #${booking.id} — ${rebatePercent}% company rebate (${tier} tier).`,
    },
  });
}

// Paginated (10/page default), date-range-filterable feed of the shared
// CompanyTransaction ledger — the write path (createCompanyTopUp/
// grantCompanyBookingRebate above, plus the Supplier Rewards Catalogue's
// earned_spend debit) has existed since Sprint 6.10, but nothing read it
// back until this (Sprint 6.10 "Supplier Analytics/Financials Reshuffle",
// 2026-07-23) — backs the Financials page's company-admin-only "Credit
// Movement" card. Same pagination/date-range shape as every other
// audit-trail feed (getWalletTransactionsPage, getBuyerOrgTransactions).
export async function getCompanyTransactionsPage(companyId: bigint, query: ActivityQuery) {
  const where: Prisma.CompanyTransactionWhereInput = {
    companyId,
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.companyTransaction.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.companyTransaction.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

// Sprint 6.12 — placeholder pricing, explicitly NOT a real product-owner
// number (per the "use a random figure for now" instruction this feature
// was scoped under). Don't treat this as confirmed; flag it the same way
// COMPANY_REBATE_PERCENT above was flagged before its real numbers landed.
export const BUMP_UNIT_COST_CREDITS = 50;

export class InsufficientCompanyPurchasedBalanceError extends Error {
  constructor() {
    super("Insufficient purchased credit balance for this purchase.");
  }
}

// "Ammo" purchase — increments Company.bumpsAvailable, debits
// purchasedBalance via a purchased_spend row. Spending (not just holding)
// company funds is gated to company admins at the route layer
// (requireCompanyAdmin), stricter than purchased_topup's "any member" gate.
export async function purchaseBumps(companyId: bigint, quantity: number, userId: string) {
  const cost = new Prisma.Decimal(creditsToSgd(quantity * BUMP_UNIT_COST_CREDITS)).toDecimalPlaces(2);

  return prisma.$transaction(async (tx) => {
    const balance = await getCompanyPurchasedBalance(companyId, tx);
    if (balance.lt(cost)) {
      throw new InsufficientCompanyPurchasedBalanceError();
    }

    await tx.companyTransaction.create({
      data: {
        companyId,
        userId,
        type: CompanyTransactionType.purchased_spend,
        amount: cost.negated(),
        description: `Purchased ${quantity} Bump${quantity === 1 ? "" : "s"}`,
      },
    });

    const company = await tx.company.update({
      where: { id: companyId },
      data: { bumpsAvailable: { increment: quantity } },
    });

    return { bumpsAvailable: company.bumpsAvailable };
  });
}

export function serializeCompanyTransaction(
  t: Awaited<ReturnType<typeof getCompanyTransactionsPage>>["items"][number]
) {
  // earned_spend (a redemption debit) is the only type that reduces the
  // balance — mirrors the sign convention getCompanyEarnedBalance's own
  // SUM relies on (a negative amount already, per how
  // lib/supplier-reward-redemptions.ts writes it), so no extra negation
  // needed here, just pass amount through as-is.
  return {
    id: t.id.toString(),
    type: t.type,
    amount: sgdToCredits(Number(t.amount)),
    description: t.description ?? t.type,
    userName: t.user?.name ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}
