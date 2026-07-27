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
// platform. Debits are negative, refunds positive, so summing every type
// below and negating nets a declined-then-refunded booking to 0 (not
// -amount) automatically.
//
// This list deliberately spans BOTH ledger generations, because the two
// coexist in a live DB during the split-ledger transition:
//   - Legacy/seed types (`booking`, `purchase`): the pre-split combined
//     ledger. prisma/seed.ts still writes `booking` rows with real amounts,
//     and any pre-transition rows use these too. (`booking` is also written
//     as a zero-amount confirm-audit row by the live path — those add 0, so
//     keeping the type in is harmless.)
//   - Split-ledger types the live write paths actually use now:
//     `booking_payment` (the real Stripe booking charge — the PRIMARY revenue
//     stream, createBookingWithDebit), `booking_modification_fee` (reschedule
//     fee, real Stripe, non-refundable — modifyBookingWithFee), and
//     `purchased_spend` (Buy Now consumables sale from purchasedBalance —
//     createPurchaseWithDebit). These were the gap: the split-ledger rewrite
//     moved every real booking/consumable charge onto these values, but this
//     list was never updated, so completed bookings reported 0 revenue and
//     refunds pushed it negative (the refund was counted, the original charge
//     wasn't). Fixed 2026-07-24 (financial audit F1).
//
// No double-counting: a live booking writes exactly one `booking_payment`
// (its charge) plus a zero-amount `booking` audit row; a Buy Now writes one
// `purchased_spend`; a bulk order one `purchase`. An earned-credit discount
// on any of them is a separate `earned_spend` row, deliberately NOT counted
// here (earned credits are promotional issuance, not money received — the
// charge row already reflects the post-discount amount actually collected).
// `topup`/`purchased_topup` (money into a user's own wallet, not revenue) and
// `earned_grant`/`earned_spend` stay excluded.
const REVENUE_TRANSACTION_TYPES: TransactionType[] = [
  "booking",
  "purchase",
  "refund",
  "booking_payment",
  "booking_modification_fee",
  "purchased_spend",
];

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

const REVENUE_FEED_PER_PAGE = 25;

// A transaction has no direct company FK — the company only exists via
// whichever of the three optional relations is set (same shape resolveCompany
// reads) — so a company-name search has to fan out across all three rather
// than filtering a single column.
function revenueFeedCompanySearch(search: string): Prisma.TransactionWhereInput {
  const nameFilter = { name: { contains: search, mode: "insensitive" as const } };
  return {
    OR: [
      { booking: { listing: { company: nameFilter } } },
      { bulkOrderRequest: { listing: { company: nameFilter } } },
      { purchase: { listing: { company: nameFilter } } },
    ],
  };
}

// Admin Financials "cross-company transaction feed" — excludes zero-amount
// rows (e.g. the booking-confirm audit row, see lib/bookings.ts) since those
// aren't revenue events, just an audit trail for one that already happened.
// search/page added 2026-07-27 (admin UI request — same "will get crazy as it
// grows" concern as the per-supplier pricing table, see listCompanyPricingOverrides).
export async function getRevenueTransactionFeed(
  options: { search?: string; page?: number } = {}
): Promise<{ transactions: RevenueTransactionRow[]; meta: { page: number; perPage: number; total: number } }> {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.TransactionWhereInput = {
    type: { in: REVENUE_TRANSACTION_TYPES },
    amount: { not: 0 },
    ...(options.search ? revenueFeedCompanySearch(options.search) : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: revenueTransactionInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REVENUE_FEED_PER_PAGE,
      take: REVENUE_FEED_PER_PAGE,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map((t) => {
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
    }),
    meta: { page, perPage: REVENUE_FEED_PER_PAGE, total },
  };
}

export interface CompanyNetPayoutByTypeMonth {
  month: string; // "YYYY-MM"
  // Numeric "credits" values — the supplier's NET PAYOUT (what SpaceSnap
  // actually pays them: 90% of base per booking, 93% of RSP per consumable,
  // minus any decline penalties), NOT the marked-up member price. Confirmed
  // with the product owner 2026-07-25 (financial audit F2/F5): the marketplace
  // markup is SpaceSnap's, so showing gross member spend on the supplier's own
  // chart overstated their earnings. Sourced from SupplierPayable.netAmount.
  space: number;
  equipment: number;
  consumable: number;
}

export interface CompanyNetPayoutRange {
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

// Supplier Financials "My Earnings" chart — the caller's own company's NET
// PAYOUT, split by listing type, per calendar month. Sourced from
// SupplierPayable.netAmount (what SpaceSnap actually pays the supplier: 90% of
// base per booking, 93% of RSP per consumable), NOT the marked-up member price
// — the markup is SpaceSnap's, not the supplier's (F2/F5, product owner
// 2026-07-25). A supplier-decline penalty on a booking is a negative payable,
// so it nets down the bucket, exactly as it nets the payout. Bucketed by the
// payable's createdAt (when the sale settled). Accepts a month countback or an
// explicit from/to range (from/to wins).
export async function getCompanyNetPayoutByTypeAndMonth(
  companyId: bigint,
  { months = 12, from, to }: CompanyNetPayoutRange = {}
): Promise<CompanyNetPayoutByTypeMonth[]> {
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

  const listingTypeSelect = { listing: { select: { type: true } } };
  const payables = await prisma.supplierPayable.findMany({
    where: { companyId, createdAt: { gte: since, ...(to ? { lte: to } : {}) } },
    select: {
      netAmount: true,
      createdAt: true,
      booking: { select: listingTypeSelect },
      purchase: { select: listingTypeSelect },
      bulkOrderRequest: { select: listingTypeSelect },
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

  for (const p of payables) {
    const listing = p.booking?.listing ?? p.purchase?.listing ?? p.bulkOrderRequest?.listing ?? null;
    if (!listing) continue;
    const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketFor(key);
    // netAmount is already the supplier's signed net (positive = paid,
    // negative = decline penalty owed back) — no negation needed here.
    bucket[listing.type] = bucket[listing.type].plus(p.netAmount);
  }

  const result: CompanyNetPayoutByTypeMonth[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < bucketCount; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    result.push({
      month: key,
      space: bucket ? sgdToCredits(Number(bucket.space)) : 0,
      equipment: bucket ? sgdToCredits(Number(bucket.equipment)) : 0,
      consumable: bucket ? sgdToCredits(Number(bucket.consumables)) : 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}
