import { ActivityActionType, Prisma, TransactionType, type RewardRedemption } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSufficientEarnedBalance } from "@/lib/credits";
import { creditsToSgd } from "@/lib/credit-units";
import { isFullyRedeemed } from "@/lib/reward-catalogue";

// The actual issuance/redemption flow RewardCatalogueItem.redeemedCount was
// added ahead of (Sprint 6.6/6.7/6.9's own follow-up note in
// SPRINT_PLAN_NEXTJS_REWRITE.md) — a user spending earnedBalance on a
// catalogue item, distinct from RewardGrant's booking/purchase-discount
// mechanic (lib/reward-grants.ts).
export class RewardRedemptionError extends Error {
  constructor(public readonly reason: "not_found" | "inactive" | "fully_redeemed") {
    super(
      reason === "not_found"
        ? "This reward does not exist."
        : reason === "inactive"
          ? "This reward is no longer available."
          : "This reward has already been fully redeemed."
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
    redeemedAt: redemption.createdAt.toISOString(),
  };
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
export async function redeemRewardCatalogueItem(userId: string, itemId: bigint): Promise<RewardRedemption> {
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

    const costSgd = new Prisma.Decimal(creditsToSgd(Number(item.creditCost)));
    await assertSufficientEarnedBalance(tx, userId, costSgd);

    const redemption = await tx.rewardRedemption.create({
      data: {
        userId,
        rewardCatalogueItemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        creditCost: item.creditCost,
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

    return redemption;
  });
}
