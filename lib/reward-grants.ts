import { Prisma, RewardGrantType, type RewardGrant } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// 2026-07-21 write-path session. A discount request must resolve against a
// specific, server-issued RewardGrant — never a client-supplied dollar
// amount or percentage (see RewardGrant's own comment in schema.prisma). No
// issuance flow exists yet for any RewardGrantType; rows are seeded/created
// directly for now, same as every other "schema now, write-path later" item
// in this codebase.
// 2026-07-22 fulfillment session: the rewards catalogue's Discount Voucher
// is the first real issuer of a RewardGrant (lib/reward-redemptions.ts) and
// gives it a real deadline — 90 days, confirmed with the product owner.
export const DISCOUNT_VOUCHER_GRANT_EXPIRY_DAYS = 90;

export class RewardGrantNotRedeemableError extends Error {
  constructor(public readonly reason: "not_found" | "wrong_type" | "already_redeemed" | "expired") {
    super(
      reason === "not_found"
        ? "This reward grant does not exist or does not belong to you."
        : reason === "wrong_type"
          ? "This reward grant cannot be applied here."
          : reason === "expired"
            ? "This reward grant has expired."
            : "This reward grant has already been redeemed or has expired."
    );
  }
}

export interface ResolvedRewardGrant {
  grant: RewardGrant;
  discount: Prisma.Decimal;
}

// Read-only sizing step. Used ahead of a Stripe PaymentIntent create (the
// booking flow needs to know the discounted charge amount before it can even
// create the intent, which happens before the DB transaction opens — see
// createBookingWithDebit, lib/bookings.ts) and, for the purchase flow, ahead
// of its own $transaction for the same "compute once, reuse the same number
// everywhere" reason. This does NOT mutate the grant — redeemRewardGrant
// below is what actually spends it, atomically, inside the caller's
// transaction. There is a race window between this read and that write (a
// grant could be redeemed by a concurrent request in between); that's fine —
// redeemRewardGrant's own status guard is the actual source of truth and
// will reject a stale redemption attempt.
export async function resolveRewardGrantDiscount(
  userId: string,
  grantId: bigint,
  expectedType: RewardGrantType,
  chargeAmount: Prisma.Decimal,
  unitPrice?: Prisma.Decimal
): Promise<ResolvedRewardGrant> {
  const grant = await prisma.rewardGrant.findUnique({ where: { id: grantId } });

  if (!grant || grant.userId !== userId) {
    throw new RewardGrantNotRedeemableError("not_found");
  }
  if (grant.type !== expectedType) {
    throw new RewardGrantNotRedeemableError("wrong_type");
  }
  if (grant.status !== "available") {
    throw new RewardGrantNotRedeemableError("already_redeemed");
  }
  if (grant.expiresAt && grant.expiresAt < new Date()) {
    throw new RewardGrantNotRedeemableError("expired");
  }

  const rawDiscount =
    expectedType === RewardGrantType.booking_discount_pct
      ? chargeAmount.mul(grant.value).div(100)
      : grant.value.mul(unitPrice ?? new Prisma.Decimal(0));

  // Clamped to the charge itself — a grant can never turn a booking/purchase
  // into a net credit to the user, regardless of what value it was issued
  // with (issuance-time integrity is out of scope here; this is the
  // redemption-time backstop).
  const discount = Prisma.Decimal.min(rawDiscount, chargeAmount).toDecimalPlaces(2);

  return { grant, discount };
}

// Atomic spend, called inside the caller's own $transaction. The updateMany's
// `status: "available"` guard is the actual concurrency control — two
// requests racing to redeem the same grant can't both succeed, regardless of
// what resolveRewardGrantDiscount saw moments earlier.
export async function redeemRewardGrant(tx: Prisma.TransactionClient, grantId: bigint): Promise<void> {
  const now = new Date();
  const result = await tx.rewardGrant.updateMany({
    where: { id: grantId, status: "available", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    data: { status: "redeemed", redeemedAt: now },
  });

  if (result.count === 0) {
    throw new RewardGrantNotRedeemableError("already_redeemed");
  }
}

// The caller's own available (unexpired) grants — GET /api/rewards/grants,
// the "Have a voucher?" checkout dropdown. Lazily flips any stale `available`
// row past its expiresAt to `expired` before returning, same "sweep on read"
// idiom as CreditHold's lazy expiry (lib/credits.ts) rather than a scheduled
// job — there's no job-scheduling infra in this codebase (see Sprint 6.11's
// own note on the still-unprovisioned Railway Cron Schedule service).
export async function listAvailableRewardGrants(userId: string): Promise<RewardGrant[]> {
  const now = new Date();

  await prisma.rewardGrant.updateMany({
    where: { userId, status: "available", expiresAt: { lt: now } },
    data: { status: "expired" },
  });

  return prisma.rewardGrant.findMany({
    where: { userId, status: "available" },
    orderBy: { createdAt: "desc" },
  });
}

export function serializeRewardGrant(grant: RewardGrant) {
  return {
    id: grant.id.toString(),
    type: grant.type,
    value: Number(grant.value),
    grantedVia: grant.grantedVia,
    expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
    createdAt: grant.createdAt.toISOString(),
  };
}
