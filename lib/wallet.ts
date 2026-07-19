import { TransactionType, type Transaction, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { getCreditBalance } from "@/lib/credits";

// Sprint 3.5 known-gap #5, corrected scope: the sprint plan's checklist item
// says "type: purchase transactions actually created by app code" — but that
// was already closed by createBulkOrderWithDebit (lib/bulk-orders.ts, known
// gap #4). Per the Transaction model's own schema comment, topup/refund are
// credit-direction and booking/purchase are debit-direction, so a wallet
// top-up (money in) belongs on `type: topup`, not `purchase`. Grepping the
// app code confirmed TransactionType.topup was, until this file, only ever
// written by prisma/seed.ts and test fixtures — never by a real request path.
// This is the actual remaining gap: the Top Up modal (components/TopUpCreditsModal.tsx)
// has no submit handler at all, on mock data (lib/mockWallet.ts).
//
// Stripe (Sprint 6, still unbuilt — grep confirms zero Stripe SDK usage
// outside seed data) isn't wired yet, so this is credits-only for now:
// no payment is actually charged. `stripePaymentIntentId` stays null until
// Sprint 6 wires a real charge ahead of this call.
export function parseTopUpFields(body: unknown): Prisma.Decimal {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let amount: Prisma.Decimal | null = null;
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0) {
    errors.amount = ["amount must be a positive number."];
  } else {
    amount = new Prisma.Decimal(b.amount).toDecimalPlaces(2);
    if (amount.lte(0)) {
      errors.amount = ["amount must be a positive number."];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return amount!;
}

interface TopUpResult {
  transaction: Transaction;
  balance: Prisma.Decimal;
}

export async function createTopUp(userId: string, amount: Prisma.Decimal): Promise<TopUpResult> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: TransactionType.topup,
        amount,
        description: "Wallet top-up",
      },
    });

    const balance = await getCreditBalance(userId, tx);

    return { transaction, balance };
  });
}

export function serializeTopUp({ transaction, balance }: TopUpResult) {
  return {
    transaction: {
      id: transaction.id.toString(),
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
    },
    balance: Number(balance),
  };
}
