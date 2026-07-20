import { CreditHoldStatus, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCreditBalance } from "@/lib/credits";

// Scoped 2026-07-20 (product owner): a hold placed on confirm expires after a
// fixed 7-day window if nothing else ever resolves it (fulfill/decline/
// cancellation-approved). There is no scheduled-job infrastructure anywhere
// in this codebase, so expiry is enforced lazily — see releaseExpiredHoldsForUser.
export const CREDIT_HOLD_WINDOW_DAYS = 7;

type Client = Prisma.TransactionClient | typeof prisma;

// Releases (status -> released) every active hold for this user whose
// expiresAt has passed. Called at the start of every available-balance read
// so a stale hold never suppresses spendable credit the buyer should have
// back — mirrors this codebase's existing "balance is always a live
// computation, never cached" convention (see credits.ts).
export async function releaseExpiredHoldsForUser(userId: string, client: Client = prisma): Promise<void> {
  await client.creditHold.updateMany({
    where: { userId, status: CreditHoldStatus.active, expiresAt: { lte: new Date() } },
    data: { status: CreditHoldStatus.released, releasedAt: new Date() },
  });
}

async function getActiveHoldsTotal(userId: string, client: Client): Promise<Prisma.Decimal> {
  const result = await client.creditHold.aggregate({
    where: { userId, status: CreditHoldStatus.active },
    _sum: { amount: true },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

interface AvailableBalance {
  balance: Prisma.Decimal;
  held: Prisma.Decimal;
  available: Prisma.Decimal;
}

// The number a confirm decision should be checked against: live ledger
// balance minus every other active (non-expired) hold the buyer currently
// has open. Always releases expired holds first, so this is never
// artificially low.
export async function getAvailableCreditBalance(userId: string, client: Client = prisma): Promise<AvailableBalance> {
  await releaseExpiredHoldsForUser(userId, client);
  const [balance, held] = await Promise.all([getCreditBalance(userId, client), getActiveHoldsTotal(userId, client)]);
  return { balance, held, available: balance.minus(held) };
}

// Thrown inside confirmBulkOrder's transaction when available balance is
// short and the caller didn't pass override:true — the route maps this to a
// clean 409 carrying the numbers, so the supplier UI can render the warning
// modal (2026-07-20 product owner decision: warn, don't hard-block; the
// supplier can push ahead via the override).
export class InsufficientAvailableCreditError extends Error {
  constructor(
    public readonly available: Prisma.Decimal,
    public readonly required: Prisma.Decimal
  ) {
    super("The buyer does not have enough available credit to cover this order.");
  }
}

// One hold per bulk order request (schema-enforced, unique bulkOrderRequestId)
// — created exactly once, at confirm.
export async function createHold(
  tx: Prisma.TransactionClient,
  params: { userId: string; bulkOrderRequestId: bigint; amount: Prisma.Decimal }
): Promise<void> {
  await tx.creditHold.create({
    data: {
      userId: params.userId,
      bulkOrderRequestId: params.bulkOrderRequestId,
      amount: params.amount,
      expiresAt: new Date(Date.now() + CREDIT_HOLD_WINDOW_DAYS * 24 * 60 * 60 * 1000),
    },
  });
}

// Idempotent no-op if there's no active hold — a request's hold may already
// have lazily expired-released by the time fulfill/decline/cancellation-
// approve runs, and that's fine, nothing further to release.
export async function releaseHoldForBulkOrder(tx: Prisma.TransactionClient, bulkOrderRequestId: bigint): Promise<void> {
  await tx.creditHold.updateMany({
    where: { bulkOrderRequestId, status: CreditHoldStatus.active },
    data: { status: CreditHoldStatus.released, releasedAt: new Date() },
  });
}
