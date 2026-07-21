// 2026-07-21 — credit:SGD display ratio changed from 1:1 to 1:10 (1 credit =
// S$0.10), per product owner decision. "Credits" stays a cosmetic display
// unit only (see the Sprint 7 ToS clause in SPRINT_PLAN_NEXTJS_REWRITE.md) —
// every internal Decimal (Booking.sgdAmount, Transaction.amount, Stripe
// charge cents, commission/refund/payout math) stays true SGD, unconverted,
// end to end. The ratio is applied exactly once on each side of the
// client/server boundary: sgdToCredits() in API serializers (read), and
// creditsToSgd() in API request parsers (write) — never inside business
// logic that computes what actually gets charged/refunded/paid out.
export const CREDITS_PER_SGD = 10;

export function sgdToCredits(sgd: number): number {
  return sgd * CREDITS_PER_SGD;
}

export function creditsToSgd(credits: number): number {
  return credits / CREDITS_PER_SGD;
}
