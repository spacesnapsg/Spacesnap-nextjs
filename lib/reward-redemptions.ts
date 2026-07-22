import {
  ActivityActionType,
  Prisma,
  RewardGrantType,
  RewardRedemptionStatus,
  TransactionType,
  type RewardRedemption,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSufficientEarnedBalance } from "@/lib/credits";
import { creditsToSgd } from "@/lib/credit-units";
import { isFullyRedeemed } from "@/lib/reward-catalogue";
import { DISCOUNT_VOUCHER_GRANT_EXPIRY_DAYS } from "@/lib/reward-grants";

// The actual issuance/redemption flow RewardCatalogueItem.redeemedCount was
// added ahead of (Sprint 6.6/6.7/6.9's own follow-up note in
// SPRINT_PLAN_NEXTJS_REWRITE.md) — a user spending earnedBalance on a
// catalogue item, distinct from RewardGrant's booking/purchase-discount
// mechanic (lib/reward-grants.ts).
//
// 2026-07-22 fulfillment session (confirmed with the product owner, see
// SPRINT_PLAN_NEXTJS_REWRITE.md Sprint 6.10's "per-category redemption/
// fulfillment design"): this now has real per-category effects instead of
// just debiting credits and logging a row —
//   - discount: mints a real, checkout-usable RewardGrant (90-day expiry).
//   - pitch_ticket/consultancy: requires picking a partner, starts `pending`
//     (an admin has to arrange scheduling and resolve it, see
//     resolveRewardRedemption below).
//   - tier_upgrade: resolves and stores its own expiresAt, and refuses a
//     second redemption while one is already active.
//   - consumable (and events/lucky_draw, still explicitly deferred/not
//     built) fall through unchanged — a plain `used` row, same as before.
export class RewardRedemptionError extends Error {
  constructor(
    public readonly reason:
      | "not_found"
      | "inactive"
      | "fully_redeemed"
      | "partner_option_required"
      | "invalid_partner_option"
      | "tier_upgrade_already_active"
  ) {
    super(
      reason === "not_found"
        ? "This reward does not exist."
        : reason === "inactive"
          ? "This reward is no longer available."
          : reason === "fully_redeemed"
            ? "This reward has already been fully redeemed."
            : reason === "partner_option_required"
              ? "Please select a partner before redeeming this reward."
              : reason === "invalid_partner_option"
                ? "That partner option is not offered by this reward."
                : "You already have an active Tier Upgrade — wait for it to expire before redeeming another one."
    );
  }
}

export class RewardRedemptionResolutionError extends Error {
  constructor(public readonly reason: "not_found" | "not_pending") {
    super(
      reason === "not_found"
        ? "This redemption does not exist."
        : "This redemption has already been resolved."
    );
  }
}

export function serializeRewardRedemption(redemption: RewardRedemption) {
  return {
    id: redemption.id.toString(),
    itemId: redemption.rewardCatalogueItemId?.toString() ?? null,
    itemName: redemption.itemName,
    itemCategory: redemption.itemCategory,
    creditCost: Number(redemption.creditCost),
    status: redemption.status,
    selectedPartnerOption: redemption.selectedPartnerOption,
    expiresAt: redemption.expiresAt ? redemption.expiresAt.toISOString() : null,
    redeemedAt: redemption.createdAt.toISOString(),
  };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Row-locked read-check-write, same "SELECT ... FOR UPDATE inside the
// $transaction" pattern as enrollUser's capacity guard (lib/training-
// enrollments.ts) — the concurrency risk is identical in shape (an integer
// cap two racing requests could both read as "not yet full"), just on
// redeemedCount/quantityAvailable instead of an enrollment count. The lock
// is taken before reading the ORM-typed row so the Decimal/enum fields below
// come back correctly typed while still covered by the same lock.
//
// creditCost is stored on RewardCatalogueItem as a "credits" display-unit
// figure (matches AdminRewards.tsx's own input, not converted anywhere in
// lib/reward-catalogue.ts) — creditsToSgd() converts it to true SGD once,
// here, before it ever touches the ledger, same edge-of-the-API-boundary
// discipline as every other read/write of this ratio (lib/credit-units.ts).
export async function redeemRewardCatalogueItem(
  userId: string,
  itemId: bigint,
  options: { selectedPartnerOption?: string } = {}
): Promise<RewardRedemption> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM reward_catalogue_items WHERE id = ${itemId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new RewardRedemptionError("not_found");
    }

    const item = await tx.rewardCatalogueItem.findUniqueOrThrow({ where: { id: itemId } });

    if (!item.active) {
      throw new RewardRedemptionError("inactive");
    }
    if (isFullyRedeemed(item)) {
      throw new RewardRedemptionError("fully_redeemed");
    }

    const now = new Date();
    let status: RewardRedemptionStatus = RewardRedemptionStatus.used;
    let selectedPartnerOption: string | null = null;
    let expiresAt: Date | null = null;

    if (item.category === "pitch_ticket" || item.category === "consultancy") {
      const choice = options.selectedPartnerOption?.trim();
      if (!choice) {
        throw new RewardRedemptionError("partner_option_required");
      }
      if (!item.partnerOptions.includes(choice)) {
        throw new RewardRedemptionError("invalid_partner_option");
      }
      selectedPartnerOption = choice;
      // Needs the admin to arrange scheduling out-of-band before this is
      // actually fulfilled — resolved via resolveRewardRedemption below.
      status = RewardRedemptionStatus.pending;
    }

    if (item.category === "tier_upgrade") {
      // Confirmed with the product owner: at most one active upgrade at a
      // time, no stacking/extension — reject outright rather than silently
      // extending the existing window.
      const activeUpgrade = await tx.rewardRedemption.findFirst({
        where: { userId, itemCategory: "tier_upgrade", expiresAt: { gt: now } },
      });
      if (activeUpgrade) {
        throw new RewardRedemptionError("tier_upgrade_already_active");
      }
      expiresAt = addMonths(now, item.upgradeDurationMonths ?? 0);
    }

    const costSgd = new Prisma.Decimal(creditsToSgd(Number(item.creditCost)));
    await assertSufficientEarnedBalance(tx, userId, costSgd);

    const redemption = await tx.rewardRedemption.create({
      data: {
        userId,
        rewardCatalogueItemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        creditCost: item.creditCost,
        status,
        selectedPartnerOption,
        expiresAt,
      },
    });

    await tx.rewardCatalogueItem.update({
      where: { id: item.id },
      data: { redeemedCount: { increment: 1 } },
    });

    await tx.transaction.create({
      data: {
        userId,
        rewardRedemptionId: redemption.id,
        type: TransactionType.earned_spend,
        amount: costSgd.negated(),
        description: `Redeemed "${item.name}" from the rewards catalogue for ${item.creditCost} credits.`,
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        actionType: ActivityActionType.reward_redeemed,
        description: `Redeemed "${item.name}" (${item.creditCost} credits).`,
      },
    });

    // discount: mints the actual checkout-usable RewardGrant — the
    // redemption row above just records that credits were spent. This is
    // what GET /api/rewards/grants (the "Have a voucher?" checkout dropdown)
    // lists and what createBookingWithDebit's rewardGrantId param redeems.
    if (item.category === "discount" && item.discountPercent) {
      await tx.rewardGrant.create({
        data: {
          userId,
          type: RewardGrantType.booking_discount_pct,
          value: item.discountPercent,
          grantedVia: "rewards_catalogue",
          expiresAt: addDays(now, DISCOUNT_VOUCHER_GRANT_EXPIRY_DAYS),
        },
      });
    }

    return redemption;
  });
}

// Admin-only. The pitch_ticket/consultancy "concierge" queue on the Admin
// Overview page — every redemption still awaiting the admin arranging
// scheduling with the user's chosen partner.
export async function listPendingConciergeRedemptions() {
  return prisma.rewardRedemption.findMany({
    where: { status: RewardRedemptionStatus.pending },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });
}

// Admin-only. Marks a pending pitch_ticket/consultancy redemption as `used`
// (the admin arranged it) or `cancelled` (it fell through — e.g. the user
// was unreachable). Only a `pending` row can be resolved — same "guard via
// the WHERE clause, not a separate read-then-write" concurrency discipline
// as redeemRewardGrant.
export async function resolveRewardRedemption(
  id: bigint,
  status: typeof RewardRedemptionStatus.used | typeof RewardRedemptionStatus.cancelled
): Promise<RewardRedemption> {
  const result = await prisma.rewardRedemption.updateMany({
    where: { id, status: RewardRedemptionStatus.pending },
    data: { status },
  });

  if (result.count === 0) {
    const existing = await prisma.rewardRedemption.findUnique({ where: { id } });
    throw new RewardRedemptionResolutionError(existing ? "not_pending" : "not_found");
  }

  return prisma.rewardRedemption.findUniqueOrThrow({ where: { id } });
}
