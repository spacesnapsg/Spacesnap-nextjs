import Stripe from "stripe";
import type { Prisma } from "@/app/generated/prisma/client";

// Sprint 3.5 write-path session (2026-07-21) — first real Stripe SDK usage in
// this codebase (grep-confirmed zero prior usage; lib/wallet.ts's top-up flow
// stayed credits-only pending this). Booking creation is the only caller so
// far (lib/bookings.ts) — consumables purchases stay purchasedBalance-funded,
// not a per-purchase Stripe charge (see lib/purchases.ts's own comment).
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Booking.sgdAmount/earnedCreditsApplied are Decimal(10,2) SGD; Stripe wants
// an integer minor-unit amount (cents). Centralized here so every call site
// rounds the same way instead of reinventing `* 100`.
export function toStripeCents(amount: Prisma.Decimal): number {
  return amount.mul(100).toDecimalPlaces(0).toNumber();
}
