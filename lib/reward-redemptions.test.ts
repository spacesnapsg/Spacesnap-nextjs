// Coverage for the Rewards Catalogue redemption flow (lib/reward-redemptions.ts)
// — the actual issuance path RewardCatalogueItem.redeemedCount was added
// ahead of in Sprint 6.6/6.7/6.9 (see that field's own schema comment and
// SPRINT_PLAN_NEXTJS_REWRITE.md's follow-up note). Hits the real dev/test
// Postgres DB through Prisma, same convention as lib/purchases.test.ts —
// earnedBalance is seeded directly via earned_grant Transaction rows rather
// than routing through a full booking-completion chain, since this module
// doesn't care how the balance got there.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType, RewardCatalogueCategory } from "../app/generated/prisma/client";
import { getEarnedBalance, InsufficientCreditBalanceError } from "./credits";
import { redeemRewardCatalogueItem, RewardRedemptionError } from "./reward-redemptions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Redemption Test User",
      email: `redemption-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createCatalogueItem(overrides: Partial<Parameters<typeof prisma.rewardCatalogueItem.create>[0]["data"]> = {}) {
  return prisma.rewardCatalogueItem.create({
    data: {
      category: RewardCatalogueCategory.consumable,
      name: "Redemption Test Reward",
      description: "A reward used only by this test file.",
      creditCost: "50",
      consumableName: "Coffee Voucher",
      consumableQuantity: 1,
      ...overrides,
    },
  });
}

async function grantEarnedCredits(userId: string, sgdAmount: string) {
  await prisma.transaction.create({
    data: { userId, type: TransactionType.earned_grant, amount: sgdAmount },
  });
}

async function cleanup(userId: string, itemId: bigint) {
  await prisma.rewardRedemption.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.rewardCatalogueItem.delete({ where: { id: itemId } });
  await prisma.user.delete({ where: { id: userId } });
}

describe("redeemRewardCatalogueItem", () => {
  test("succeeds: debits exactly creditCost/10 SGD from earnedBalance, increments redeemedCount, writes RewardRedemption + earned_spend Transaction + reward_redeemed ActivityLog", async () => {
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "50" }); // 50 credits = S$5.00
    try {
      await grantEarnedCredits(user.id, "10.00");

      const redemption = await redeemRewardCatalogueItem(user.id, item.id);

      assert.equal(redemption.userId, user.id);
      assert.equal(redemption.rewardCatalogueItemId, item.id);
      assert.equal(redemption.itemName, item.name);
      assert.equal(redemption.itemCategory, item.category);
      assert.equal(redemption.creditCost.toString(), "50");

      const balanceAfter = await getEarnedBalance(user.id);
      assert.equal(balanceAfter.toString(), "5"); // 10.00 - 5.00

      const itemAfter = await prisma.rewardCatalogueItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(itemAfter.redeemedCount, 1);

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id, type: TransactionType.earned_spend } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].amount.toString(), "-5");
      assert.equal(transactions[0].rewardRedemptionId, redemption.id);

      const activity = await prisma.activityLog.findMany({ where: { userId: user.id, actionType: "reward_redeemed" } });
      assert.equal(activity.length, 1);
    } finally {
      await cleanup(user.id, item.id);
    }
  });

  test("rejects with InsufficientCreditBalanceError when earnedBalance is short, and writes nothing", async () => {
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "50" }); // needs S$5.00
    try {
      await grantEarnedCredits(user.id, "1.00"); // only S$1.00 available

      await assert.rejects(() => redeemRewardCatalogueItem(user.id, item.id), InsufficientCreditBalanceError);

      const itemAfter = await prisma.rewardCatalogueItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(itemAfter.redeemedCount, 0);
      const redemptions = await prisma.rewardRedemption.findMany({ where: { userId: user.id } });
      assert.equal(redemptions.length, 0);
    } finally {
      await cleanup(user.id, item.id);
    }
  });

  test("rejects with RewardRedemptionError('inactive') for a deactivated item, even with sufficient balance", async () => {
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "10", active: false });
    try {
      await grantEarnedCredits(user.id, "100.00");

      await assert.rejects(
        () => redeemRewardCatalogueItem(user.id, item.id),
        (error: unknown) => error instanceof RewardRedemptionError && error.reason === "inactive"
      );
    } finally {
      await cleanup(user.id, item.id);
    }
  });

  test("rejects with RewardRedemptionError('fully_redeemed') once redeemedCount reaches quantityAvailable", async () => {
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "10", quantityAvailable: 1, redeemedCount: 1 });
    try {
      await grantEarnedCredits(user.id, "100.00");

      await assert.rejects(
        () => redeemRewardCatalogueItem(user.id, item.id),
        (error: unknown) => error instanceof RewardRedemptionError && error.reason === "fully_redeemed"
      );
    } finally {
      await cleanup(user.id, item.id);
    }
  });

  test("rejects with RewardRedemptionError('not_found') for an unknown item id", async () => {
    const user = await createUser();
    const item = await createCatalogueItem();
    try {
      await grantEarnedCredits(user.id, "100.00");

      await assert.rejects(
        () => redeemRewardCatalogueItem(user.id, item.id + BigInt(999999)),
        (error: unknown) => error instanceof RewardRedemptionError && error.reason === "not_found"
      );
    } finally {
      await cleanup(user.id, item.id);
    }
  });

  test("unlimited item (quantityAvailable null) can be redeemed repeatedly", async () => {
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "10", quantityAvailable: null }); // S$1.00 each
    try {
      await grantEarnedCredits(user.id, "3.00");

      await redeemRewardCatalogueItem(user.id, item.id);
      await redeemRewardCatalogueItem(user.id, item.id);
      await redeemRewardCatalogueItem(user.id, item.id);

      const itemAfter = await prisma.rewardCatalogueItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(itemAfter.redeemedCount, 3);

      const balanceAfter = await getEarnedBalance(user.id);
      assert.equal(balanceAfter.toString(), "0");
    } finally {
      await cleanup(user.id, item.id);
    }
  });
});
