import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";
import { getAvailableCreditBalance } from "@/lib/credit-holds";
import { getPurchasedBalance, getEarnedBalance } from "@/lib/credits";
import { sgdToCredits } from "@/lib/credit-units";

// GET: the caller's own wallet — live balance (see lib/credits.ts, never
// stored denormalized) plus transaction history. Sprint 4.5 addition: no
// read path existed for the wallet page to consume, only POST /topup.
// `held`/`available` added 2026-07-20 (credit-hold feature) — `balance`
// stays the full ledger sum for backward compatibility, `available` is what
// actually matters for "can this user afford another action right now."
//
// `purchased`/`earned` added 2026-07-21 for the Financials page's split
// display. The earned figure is a "credits" unit count (this route's own
// cosmetic display unit, see lib/credit-units.ts and the Sprint 7 ToS
// clause), never a raw SGD/dollar figure — consistent with the standing
// compliance rule on the getEarnedBalance helper (lib/credits.ts): this
// field is deliberately not named after that helper, and is never rendered
// with a "$"/SGD prefix by any caller (see lib/earned-balance-guard.test.ts).
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const [{ balance, held, available }, purchased, earned, transactions] = await Promise.all([
    getAvailableCreditBalance(session.user.id),
    getPurchasedBalance(session.user.id),
    getEarnedBalance(session.user.id),
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
    balance: sgdToCredits(Number(balance)),
    held: sgdToCredits(Number(held)),
    available: sgdToCredits(Number(available)),
    purchased: sgdToCredits(Number(purchased)),
    earned: sgdToCredits(Number(earned)),
    transactions: transactions.map((t) => ({
      id: t.id.toString(),
      type: t.type,
      amount: sgdToCredits(Number(t.amount)),
      description: t.description ?? t.booking?.listing.name ?? t.bulkOrderRequest?.listing.name ?? t.type,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
