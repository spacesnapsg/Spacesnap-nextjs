import {
  ActivityActionType,
  CompanyTransactionType,
  Prisma,
  SupplierRewardRedemptionStatus,
  type SupplierRewardRedemption,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSufficientCompanyEarnedBalance } from "@/lib/company-credits";
import { creditsToSgd } from "@/lib/credit-units";
import { isFullyRedeemed } from "@/lib/supplier-reward-catalogue";

// The company-scoped mirror of lib/reward-redemptions.ts — a company
// spending its own earned_rebate CompanyTransaction balance on a
// SupplierRewardCatalogueItem. Per-category effects, same design posture as
// the user-facing catalogue (confirmed with the product owner, Sprint 6.10):
//   - report/ad: no automation exists (no report-generation engine, no
//     ad-serving system), so these start `pending` for an admin to fulfil
//     out-of-band, then resolve via resolveSupplierRewardRedemption below —
//     same "concierge queue" shape as the user catalogue's pitch_ticket/
//     consultancy.
//   - system (Tier Boost): resolves and stores its own expiresAt, and
//     refuses a second redemption while one is already active — same rule
//     as tier_upgrade on the user-facing catalogue.
export class SupplierRewardRedemptionError extends Error {
  constructor(
    public readonly reason: "not_found" | "inactive" | "fully_redeemed" | "tier_boost_already_active"
  ) {
    super(
      reason === "not_found"
        ? "This reward does not exist."
        : reason === "inactive"
          ? "This reward is no longer available."
          : reason === "fully_redeemed"
            ? "This reward has already been fully redeemed."
            : "Your company already has an active Tier Boost — wait for it to expire before redeeming another one."
    );
  }
}

export class SupplierRewardRedemptionResolutionError extends Error {
  constructor(public readonly reason: "not_found" | "not_pending") {
    super(
      reason === "not_found"
        ? "This redemption does not exist."
        : "This redemption has already been resolved."
    );
  }
}

export function serializeSupplierRewardRedemption(redemption: SupplierRewardRedemption) {
  return {
    id: redemption.id.toString(),
    itemId: redemption.supplierRewardCatalogueItemId?.toString() ?? null,
    itemName: redemption.itemName,
    itemCategory: redemption.itemCategory,
    creditCost: Number(redemption.creditCost),
    status: redemption.status,
    expiresAt: redemption.expiresAt ? redemption.expiresAt.toISOString() : null,
    redeemedAt: redemption.createdAt.toISOString(),
  };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

// Row-locked read-check-write, same "SELECT ... FOR UPDATE inside the
// $transaction" pattern as redeemRewardCatalogueItem (lib/reward-
// redemptions.ts) and enrollUser's capacity guard (lib/training-
// enrollments.ts).
//
// creditCost is a "credits" display-unit figure — creditsToSgd() converts it
// to true SGD once, here, before it ever touches the company ledger, same
// edge-of-the-API-boundary discipline as every other read/write of this
// ratio (lib/credit-units.ts).
export async function redeemSupplierRewardCatalogueItem(
  companyId: bigint,
  redeemedByUserId: string,
  itemId: bigint
): Promise<SupplierRewardRedemption> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM supplier_reward_catalogue_items WHERE id = ${itemId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new SupplierRewardRedemptionError("not_found");
    }

    const item = await tx.supplierRewardCatalogueItem.findUniqueOrThrow({ where: { id: itemId } });

    if (!item.active) {
      throw new SupplierRewardRedemptionError("inactive");
    }
    if (isFullyRedeemed(item)) {
      throw new SupplierRewardRedemptionError("fully_redeemed");
    }

    const now = new Date();
    let status: SupplierRewardRedemptionStatus = SupplierRewardRedemptionStatus.used;
    let expiresAt: Date | null = null;

    if (item.category === "report" || item.category === "ad") {
      // Needs an admin to actually generate the report / arrange the ad
      // placement out-of-band before this is fulfilled — resolved via
      // resolveSupplierRewardRedemption below.
      status = SupplierRewardRedemptionStatus.pending;
    }

    if (item.category === "system") {
      // Confirmed with the product owner (same rule as the user-facing
      // tier_upgrade): at most one active boost at a time, no
      // stacking/extension.
      const activeBoost = await tx.supplierRewardRedemption.findFirst({
        where: { companyId, itemCategory: "system", expiresAt: { gt: now } },
      });
      if (activeBoost) {
        throw new SupplierRewardRedemptionError("tier_boost_already_active");
      }
      expiresAt = addMonths(now, item.upgradeDurationMonths ?? 0);
    }

    const costSgd = new Prisma.Decimal(creditsToSgd(Number(item.creditCost)));
    await assertSufficientCompanyEarnedBalance(tx, companyId, costSgd);

    const redemption = await tx.supplierRewardRedemption.create({
      data: {
        companyId,
        redeemedByUserId,
        supplierRewardCatalogueItemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        creditCost: item.creditCost,
        status,
        expiresAt,
      },
    });

    await tx.supplierRewardCatalogueItem.update({
      where: { id: item.id },
      data: { redeemedCount: { increment: 1 } },
    });

    await tx.companyTransaction.create({
      data: {
        companyId,
        userId: redeemedByUserId,
        supplierRewardRedemptionId: redemption.id,
        type: CompanyTransactionType.earned_spend,
        amount: costSgd.negated(),
        description: `Redeemed "${item.name}" from the supplier rewards catalogue for ${item.creditCost} credits.`,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: redeemedByUserId,
        actionType: ActivityActionType.supplier_reward_redeemed,
        description: `Redeemed "${item.name}" (${item.creditCost} credits) from the supplier rewards catalogue.`,
      },
    });

    return redemption;
  });
}

// Admin-only. The report/ad "concierge" queue — every redemption still
// awaiting the admin actually generating the report / arranging the ad
// placement.
export async function listPendingSupplierConciergeRedemptions() {
  return prisma.supplierRewardRedemption.findMany({
    where: { status: SupplierRewardRedemptionStatus.pending },
    orderBy: { createdAt: "asc" },
    include: {
      company: { select: { name: true } },
      redeemedByUser: { select: { name: true, email: true } },
    },
  });
}

// Admin-only. Marks a pending report/ad redemption as `used` (the admin
// fulfilled it) or `cancelled`. Only a `pending` row can be resolved — same
// "guard via the WHERE clause, not a separate read-then-write" concurrency
// discipline as resolveRewardRedemption.
export async function resolveSupplierRewardRedemption(
  id: bigint,
  status: typeof SupplierRewardRedemptionStatus.used | typeof SupplierRewardRedemptionStatus.cancelled
): Promise<SupplierRewardRedemption> {
  const result = await prisma.supplierRewardRedemption.updateMany({
    where: { id, status: SupplierRewardRedemptionStatus.pending },
    data: { status },
  });

  if (result.count === 0) {
    const existing = await prisma.supplierRewardRedemption.findUnique({ where: { id } });
    throw new SupplierRewardRedemptionResolutionError(existing ? "not_pending" : "not_found");
  }

  return prisma.supplierRewardRedemption.findUniqueOrThrow({ where: { id } });
}
