import { Prisma } from "@/app/generated/prisma/client";
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
export async function getCreditBalance(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Prisma.Decimal> {
  const result = await client.transaction.aggregate({
    where: { userId },
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
