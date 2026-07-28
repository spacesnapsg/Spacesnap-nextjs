import { Prisma, TransactionType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Shared by every credit-affecting create path (booking creation, bulk-order
// creation) that needs to check-balance-then-debit atomically. Thrown inside
// a $transaction callback and caught in the route, turned into a clean 422 —
// there's no DB constraint backstopping this (unlike the bookings overlap
// exclusion constraint), so this app-layer check is the only line of defense.
export class InsufficientCreditBalanceError extends Error {
  constructor(
    public readonly balance: Prisma.Decimal,
    public readonly required: Prisma.Decimal
  ) {
    super("Insufficient credit balance for this request.");
  }
}

// Balance is never stored denormalized (see the Transaction model's comment
// in schema.prisma) — it's always the live SUM of the user's ledger rows.
// Accepts a $transaction callback's tx client so the read can happen inside
// the same transaction as the debit write in assertSufficientBalance below.
//
// 2026-07-28 (Buyer Org pool spend): explicitly excludes buyerOrganizationId
// rows — a member's org-pool top-up/spend is money that belongs to the
// org's shared pool (see getBuyerOrgPoolBalance below), not this member's
// own personal balance, even though userId still names them as the acting
// member on that row (same "who did it vs. whose pool it drew from"
// distinction as Transaction.buyerOrganizationId's own schema comment).
// Without this filter a member funding/spending the org pool would see
// their own personal balance move too, double-representing the same money.
export async function getCreditBalance(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const result = await client.transaction.aggregate({
    where: { userId, buyerOrganizationId: null },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

// The Buyer Organization's own shared pool balance — the counterpart to
// getCreditBalance above, summed across every member's org-attributed rows
// (buyerOrganizationId set) rather than a single user's personal ledger.
// Deliberately no `type` filter (same "blind SUM" idiom as getCreditBalance
// before the purchased/earned split existed) — buyerOrganizationId is NEVER
// set on any Transaction row except the pool's own: a top-up
// (purchased_topup, createTopUp/lib/wallet.ts), a Buy-Now debit
// (purchased_spend, createPurchaseWithDebit/lib/purchases.ts), AND a
// booking debit (booking_payment, createBookingWithDebit/lib/bookings.ts —
// this one is NOT purchased_spend, unlike a personal Buy Now, so filtering
// to just purchased_topup/purchased_spend would silently exclude every
// org-funded booking's own debit). If a future write path ever needs to
// exclude a specific type from the pool sum, add the filter back deliberately
// then — don't reintroduce it speculatively.
export async function getBuyerOrgPoolBalance(
  buyerOrganizationId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const result = await client.transaction.aggregate({
    where: { buyerOrganizationId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

// 2026-07-21 — purchasedBalance/earnedBalance, computed off the same live
// ledger as getCreditBalance above, per the two SUM formulas documented on
// TransactionType in schema.prisma. Neither is wired to any route yet (no
// endpoint needs them until the write paths that populate purchased_*/
// earned_* rows are built — see the Sprint 3.5/6 gaps in
// SPRINT_PLAN_NEXTJS_REWRITE.md), added now so future write-path work has a
// correct helper to call instead of reinventing the aggregate.
//
// earnedBalance in particular is for internal discount-resolution
// arithmetic ONLY — never serialize or display it directly as a currency
// amount to a user (compliance rule, not a style preference: earned
// credits must always be shown as a percentage, a unit count, or tied to a
// specific service — "10% off your next booking", "1 free consumables
// pack" — never a dollar figure like "$47 balance"; see the 2026-07-21
// consumables/gigs session notes in SPRINT_PLAN_NEXTJS_REWRITE.md for the
// full rationale). If an endpoint ever needs to expose a member's
// earned-credit position, it must return a structured reward description
// (e.g. `{ type: "booking_discount_pct", value: 10 }`), never a bare
// `{ balance: <this number> }`. lib/earned-balance-guard.test.ts statically
// checks that no existing API route response does this.
// buyerOrganizationId: null for the same reason as getCreditBalance above —
// a member's own org-pool top-up/spend rows must not inflate/deflate their
// personal purchasedBalance.
export async function getPurchasedBalance(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const result = await client.transaction.aggregate({
    where: { userId, buyerOrganizationId: null, type: { in: [TransactionType.purchased_topup, TransactionType.purchased_spend] } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

export async function getEarnedBalance(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const result = await client.transaction.aggregate({
    where: { userId, buyerOrganizationId: null, type: { in: [TransactionType.earned_grant, TransactionType.earned_spend] } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

// Reads the live balance inside the given transaction and throws
// InsufficientCreditBalanceError if it's short of `cost`. Callers run this
// first inside their own $transaction, then create the row being paid for
// and its debit Transaction — see createBookingWithDebit (lib/bookings.ts)
// and fulfillBulkOrderWithDebit (lib/bulk-orders.ts, checked at fulfillment
// time, not at request creation) for the current call sites of this same
// "check balance, debit, create Transaction" pattern.
export async function assertSufficientBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  cost: Prisma.Decimal
): Promise<void> {
  const balance = await getCreditBalance(userId, tx);
  if (balance.lt(cost)) {
    throw new InsufficientCreditBalanceError(balance, cost);
  }
}

// 2026-07-21 write-path session: the purchasedBalance-specific counterpart to
// assertSufficientBalance above, for write paths that have been rewired to
// the split model (createPurchaseWithDebit, lib/purchases.ts) — checks only
// purchased_topup/purchased_spend rows, never the combined ledger, since
// consumables purchases can only ever be paid from purchasedBalance (never
// earnedBalance directly — an earned discount is resolved separately via a
// RewardGrant redemption, see lib/reward-grants.ts, and reduces what this
// function is asked to check, not what it sums).
export async function assertSufficientPurchasedBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  cost: Prisma.Decimal
): Promise<void> {
  const balance = await getPurchasedBalance(userId, tx);
  if (balance.lt(cost)) {
    throw new InsufficientCreditBalanceError(balance, cost);
  }
}

// getBuyerOrgPoolBalance counterpart, same shape as
// assertSufficientPurchasedBalance above — the org-funded booking/Buy Now
// paths (createBookingWithDebit/createPurchaseWithDebit) call this instead
// of assertSufficient(Purchased)Balance when a buyerOrganizationId is
// supplied.
export async function assertSufficientBuyerOrgPoolBalance(
  tx: Prisma.TransactionClient,
  buyerOrganizationId: bigint,
  cost: Prisma.Decimal
): Promise<void> {
  const balance = await getBuyerOrgPoolBalance(buyerOrganizationId, tx);
  if (balance.lt(cost)) {
    throw new InsufficientCreditBalanceError(balance, cost);
  }
}

// earnedBalance counterpart, same shape as assertSufficientPurchasedBalance
// above. First real caller: lib/reward-redemptions.ts (Rewards Catalogue
// redemption) — a booking/purchase discount checks a specific RewardGrant's
// own value instead (lib/reward-grants.ts), not this.
export async function assertSufficientEarnedBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  cost: Prisma.Decimal
): Promise<void> {
  const balance = await getEarnedBalance(userId, tx);
  if (balance.lt(cost)) {
    throw new InsufficientCreditBalanceError(balance, cost);
  }
}
