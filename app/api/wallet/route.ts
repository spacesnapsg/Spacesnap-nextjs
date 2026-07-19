import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";
import { getCreditBalance } from "@/lib/credits";

// GET: the caller's own wallet — live balance (see lib/credits.ts, never
// stored denormalized) plus transaction history. Sprint 4.5 addition: no
// read path existed for the wallet page to consume, only POST /topup.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const [balance, transactions] = await Promise.all([
    getCreditBalance(session.user.id),
    prisma.transaction.findMany({
      where: { userId: session.user.id },
      include: {
        booking: { include: { listing: { select: { name: true } } } },
        bulkOrderRequest: { include: { listing: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    balance: Number(balance),
    transactions: transactions.map((t) => ({
      id: t.id.toString(),
      type: t.type,
      amount: Number(t.amount),
      description: t.description ?? t.booking?.listing.name ?? t.bulkOrderRequest?.listing.name ?? t.type,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
