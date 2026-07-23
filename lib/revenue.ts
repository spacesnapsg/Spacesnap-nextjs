import { Prisma, type TransactionType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sgdToCredits } from "@/lib/credit-units";

// Every revenue figure this module returns is a formatted "credits" string
// (this app's cosmetic display unit, see lib/credit-units.ts) — the
// underlying ledger sum stays true SGD throughout the aggregation above,
// converted once here at the final formatting step.
function formatAsCredits(sgd: Prisma.Decimal): string {
  return sgdToCredits(Number(sgd)).toFixed(2);
}

// "Revenue" = money that actually moved from a user to an operator/the
// platform. `topup` is money entering a user's own wallet, not revenue —
// excluded. `booking`/`purchase` are debits (negative amount); `refund`
// reverses a booking debit (positive amount), so summing all three and
// negating nets out declined bookings correctly (a booking that was
// declined contributes 0, not -amount).
const REVENUE_TRANSACTION_TYPES: TransactionType[] = ["booking", "purchase", "refund"];

const revenueTransactionInclude = {
  booking: { select: { listing: { select: { companyId: true, company: { select: { name: true } } } } } },
  bulkOrderRequest: { select: { listing: { select: { companyId: true, company: { select: { name: true } } } } } },
  purchase: { select: { listing: { select: { companyId: true, company: { select: { name: true } } } } } },
} satisfies Prisma.TransactionInclude;

type RevenueTransaction = Prisma.TransactionGetPayload<{ include: typeof revenueTransactionInclude }>;

// A transaction is attributed to whichever of the three optional relations
// is set (exactly one ever is, per how each is created — see lib/bookings.ts,
// lib/bulk-orders.ts, lib/purchases.ts). No relation set means a topup,
// already excluded by REVENUE_TRANSACTION_TYPES, but guarded here too.
function resolveCompany(txn: RevenueTransaction): { companyId: bigint; companyName: string } | null {
  const listing = txn.booking?.listing ?? txn.bulkOrderRequest?.listing ?? txn.purchase?.listing ?? null;
  return listing ? { companyId: listing.companyId, companyName: listing.company.name } : null;
}

async function getRevenueTransactions(where: Prisma.TransactionWhereInput = {}) {
  return prisma.transaction.findMany({
    where: { type: { in: REVENUE_TRANSACTION_TYPES }, ...where },
    include: revenueTransactionInclude,
  });
}

export interface PlatformRevenueSummary {
  totalCompanies: number;
  totalBookings: number;
  totalRevenue: string;
}

// Admin Overview stat cards.
export async function getPlatformRevenueSummary(): Promise<PlatformRevenueSummary> {
  const [totalCompanies, totalBookings, transactions] = await Promise.all([
    prisma.company.count(),
    prisma.booking.count(),
    getRevenueTransactions(),
  ]);

  const totalRevenue = transactions
    .reduce((sum, t) => sum.plus(t.amount), new Prisma.Decimal(0))
    .negated();

  return { totalCompanies, totalBookings, totalRevenue: formatAsCredits(totalRevenue) };
}

export interface CompanyRevenue {
  companyId: string;
  companyName: string;
  revenue: string;
}

// Admin Financials "revenue by operator" table — every company, including
// ones with zero revenue so far.
export async function getRevenueByCompany(): Promise<CompanyRevenue[]> {
  const [companies, transactions] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getRevenueTransactions(),
  ]);

  const totals = new Map<string, Prisma.Decimal>();
  for (const txn of transactions) {
    const company = resolveCompany(txn);
    if (!company) continue;
    const key = company.companyId.toString();
    totals.set(key, (totals.get(key) ?? new Prisma.Decimal(0)).plus(txn.amount));
  }

  return companies.map((c) => ({
    companyId: c.id.toString(),
    companyName: c.name,
    revenue: formatAsCredits((totals.get(c.id.toString()) ?? new Prisma.Decimal(0)).negated()),
  }));
}

export interface RevenueTransactionRow {
  id: string;
  createdAt: string;
  type: TransactionType;
  amount: string;
  companyId: string | null;
  companyName: string | null;
  description: string | null;
}

// Admin Financials "cross-company transaction feed" — excludes zero-amount
// rows (e.g. the booking-confirm audit row, see lib/bookings.ts) since those
// aren't revenue events, just an audit trail for one that already happened.
export async function getRevenueTransactionFeed(limit = 25): Promise<RevenueTransactionRow[]> {
  const transactions = await prisma.transaction.findMany({
    where: { type: { in: REVENUE_TRANSACTION_TYPES }, amount: { not: 0 } },
    include: revenueTransactionInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return transactions.map((t) => {
    const company = resolveCompany(t);
    return {
      id: t.id.toString(),
      createdAt: t.createdAt.toISOString(),
      type: t.type,
      amount: formatAsCredits(t.amount.negated()),
      companyId: company?.companyId.toString() ?? null,
      companyName: company?.companyName ?? null,
      description: t.description,
    };
  });
}

export interface CompanyRevenueByTypeMonth {
  month: string; // "YYYY-MM"
  // Numeric "credits" values (this app's cosmetic display unit) — the chart
  // (recharts) needs numbers, not the formatted strings the text-display
  // helpers above return. Revenue, not earned credits, so the
  // earned-balance display constraint doesn't apply here.
  space: number;
  equipment: number;
  consumable: number;
}

export interface CompanyRevenueByTypeRange {
  // Either months (the original preset toggle) or an explicit from/to date
  // range (2026-07-23, Platform Revenue date picker) — from/to wins when
  // given. months stays the fallback for the initial/no-filter state.
  months?: number;
  from?: Date;
  to?: Date;
}

// Hard cap on bucket count regardless of how wide a custom from/to range is
// — an "All time" pick on a years-old company shouldn't generate hundreds of
// mostly-empty monthly buckets.
const MAX_REVENUE_BUCKETS = 60;

function startOfMonth(d: Date): Date {
  const start = new Date(d);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Supplier Financials "Platform Revenue" chart — the caller's own company,
// split by the LISTING TYPE each revenue transaction is attributable to, per
// calendar month. Same REVENUE_TRANSACTION_TYPES / negate-to-net-out-refunds
// semantics as every other aggregate in this module — a declined-then-
// refunded booking nets to 0 in its bucket, not a negative. Replaces
// buildPlaceholderRevenueByType in app/(supplier)/supplier-financials/page.tsx
// (Sprint 6.10). Extended 2026-07-23 to accept an explicit from/to date
// range (Platform Revenue's date picker) instead of only a fixed month
// countback — still bucketed monthly, since the chart itself is monthly bars.
export async function getCompanyRevenueByTypeAndMonth(
  companyId: bigint,
  { months = 12, from, to }: CompanyRevenueByTypeRange = {}
): Promise<CompanyRevenueByTypeMonth[]> {
  const until = to ? startOfMonth(to) : startOfMonth(new Date());
  let since: Date;
  if (from) {
    since = startOfMonth(from);
  } else {
    since = new Date(until);
    since.setMonth(since.getMonth() - (months - 1));
  }

  let bucketCount = (until.getFullYear() - since.getFullYear()) * 12 + (until.getMonth() - since.getMonth()) + 1;
  if (bucketCount < 1) bucketCount = 1;
  if (bucketCount > MAX_REVENUE_BUCKETS) {
    bucketCount = MAX_REVENUE_BUCKETS;
    since = new Date(until);
    since.setMonth(since.getMonth() - (bucketCount - 1));
  }

  const listingTypeSelect = { listing: { select: { companyId: true, type: true } } };
  const transactions = await prisma.transaction.findMany({
    where: {
      type: { in: REVENUE_TRANSACTION_TYPES },
      createdAt: { gte: since, ...(to ? { lte: to } : {}) },
      OR: [
        { booking: { listing: { companyId } } },
        { bulkOrderRequest: { listing: { companyId } } },
        { purchase: { listing: { companyId } } },
      ],
    },
    select: {
      amount: true,
      createdAt: true,
      booking: { select: listingTypeSelect },
      bulkOrderRequest: { select: listingTypeSelect },
      purchase: { select: listingTypeSelect },
    },
  });

  // month -> { space, equipment, consumables } running Decimal sums.
  const buckets = new Map<string, { space: Prisma.Decimal; equipment: Prisma.Decimal; consumables: Prisma.Decimal }>();
  function bucketFor(key: string) {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { space: new Prisma.Decimal(0), equipment: new Prisma.Decimal(0), consumables: new Prisma.Decimal(0) };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  for (const t of transactions) {
    const listing = t.booking?.listing ?? t.bulkOrderRequest?.listing ?? t.purchase?.listing ?? null;
    if (!listing) continue;
    const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketFor(key);
    bucket[listing.type] = bucket[listing.type].plus(t.amount);
  }

  const result: CompanyRevenueByTypeMonth[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < bucketCount; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    result.push({
      month: key,
      space: bucket ? sgdToCredits(Number(bucket.space.negated())) : 0,
      equipment: bucket ? sgdToCredits(Number(bucket.equipment.negated())) : 0,
      consumable: bucket ? sgdToCredits(Number(bucket.consumables.negated())) : 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}
