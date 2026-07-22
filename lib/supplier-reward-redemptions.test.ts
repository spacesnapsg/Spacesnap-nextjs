// Coverage for the Supplier Rewards Catalogue redemption flow
// (lib/supplier-reward-redemptions.ts) — the company-scoped mirror of
// lib/reward-redemptions.test.ts. Hits the real dev/test Postgres DB
// through Prisma, same convention as lib/company-credits.test.ts —
// earnedBalance (company-level, via earned_rebate) is seeded directly via a
// CompanyTransaction row rather than routing through a full
// booking-completion chain, since this module doesn't care how the balance
// got there.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CompanyTransactionType, SupplierRewardCategory } from "../app/generated/prisma/client";
import { getCompanyEarnedBalance } from "./company-credits";
import { InsufficientCreditBalanceError } from "./credits";
import { getCompanySupplierTier } from "./supplier-tiers";
import {
  redeemSupplierRewardCatalogueItem,
  resolveSupplierRewardRedemption,
  SupplierRewardRedemptionError,
  SupplierRewardRedemptionResolutionError,
} from "./supplier-reward-redemptions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Supplier Rewards Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Supplier Rewards Test User",
      email: `supplier-rewards-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createCatalogueItem(overrides: Partial<Parameters<typeof prisma.supplierRewardCatalogueItem.create>[0]["data"]> = {}) {
  return prisma.supplierRewardCatalogueItem.create({
    data: {
      category: SupplierRewardCategory.report,
      name: "Supplier Rewards Test Item",
      description: "A reward used only by this test file.",
      creditCost: "50",
      ...overrides,
    },
  });
}

async function grantEarnedCredits(companyId: bigint, sgdAmount: string) {
  await prisma.companyTransaction.create({
    data: { companyId, type: CompanyTransactionType.earned_rebate, amount: sgdAmount },
  });
}

async function cleanup(companyId: bigint, userId: string, itemId: bigint) {
  await prisma.companyTransaction.deleteMany({ where: { companyId } });
  await prisma.supplierRewardRedemption.deleteMany({ where: { companyId } });
  await prisma.supplierRewardCatalogueItem.delete({ where: { id: itemId } });
  await prisma.company.delete({ where: { id: companyId } });
  await prisma.user.delete({ where: { id: userId } });
}

describe("redeemSupplierRewardCatalogueItem", () => {
  test("succeeds: debits exactly creditCost/10 SGD from the company's earnedBalance, increments redeemedCount, writes SupplierRewardRedemption + earned_spend CompanyTransaction + supplier_reward_redeemed ActivityLog", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "50" }); // 50 credits = S$5.00
    try {
      await grantEarnedCredits(company.id, "10.00");

      const redemption = await redeemSupplierRewardCatalogueItem(company.id, user.id, item.id);

      assert.equal(redemption.companyId, company.id);
      assert.equal(redemption.redeemedByUserId, user.id);
      assert.equal(redemption.supplierRewardCatalogueItemId, item.id);
      assert.equal(redemption.itemName, item.name);
      assert.equal(redemption.itemCategory, item.category);
      assert.equal(redemption.creditCost.toString(), "50");
      assert.equal(redemption.status, "pending"); // report starts pending

      const balanceAfter = await getCompanyEarnedBalance(company.id);
      assert.equal(balanceAfter.toString(), "5"); // 10.00 - 5.00

      const itemAfter = await prisma.supplierRewardCatalogueItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(itemAfter.redeemedCount, 1);

      const transactions = await prisma.companyTransaction.findMany({
        where: { companyId: company.id, type: CompanyTransactionType.earned_spend },
      });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].amount.toString(), "-5");
      assert.equal(transactions[0].userId, user.id);
      assert.equal(transactions[0].supplierRewardRedemptionId, redemption.id);

      const activity = await prisma.activityLog.findMany({ where: { userId: user.id, actionType: "supplier_reward_redeemed" } });
      assert.equal(activity.length, 1);
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });

  test("rejects with InsufficientCreditBalanceError when the company's earnedBalance is short, and writes nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "50" }); // needs S$5.00
    try {
      await grantEarnedCredits(company.id, "1.00"); // only S$1.00 available

      await assert.rejects(
        () => redeemSupplierRewardCatalogueItem(company.id, user.id, item.id),
        InsufficientCreditBalanceError
      );

      const itemAfter = await prisma.supplierRewardCatalogueItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(itemAfter.redeemedCount, 0);
      const redemptions = await prisma.supplierRewardRedemption.findMany({ where: { companyId: company.id } });
      assert.equal(redemptions.length, 0);
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });

  test("rejects with SupplierRewardRedemptionError('inactive') for a deactivated item, even with sufficient balance", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "10", active: false });
    try {
      await grantEarnedCredits(company.id, "100.00");

      await assert.rejects(
        () => redeemSupplierRewardCatalogueItem(company.id, user.id, item.id),
        (error: unknown) => error instanceof SupplierRewardRedemptionError && error.reason === "inactive"
      );
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });

  test("rejects with SupplierRewardRedemptionError('fully_redeemed') once redeemedCount reaches quantityAvailable", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({ creditCost: "10", quantityAvailable: 1, redeemedCount: 1 });
    try {
      await grantEarnedCredits(company.id, "100.00");

      await assert.rejects(
        () => redeemSupplierRewardCatalogueItem(company.id, user.id, item.id),
        (error: unknown) => error instanceof SupplierRewardRedemptionError && error.reason === "fully_redeemed"
      );
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });

  test("rejects with SupplierRewardRedemptionError('not_found') for an unknown item id", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem();
    try {
      await grantEarnedCredits(company.id, "100.00");

      await assert.rejects(
        () => redeemSupplierRewardCatalogueItem(company.id, user.id, item.id + BigInt(999999)),
        (error: unknown) => error instanceof SupplierRewardRedemptionError && error.reason === "not_found"
      );
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });

  test("unlimited item (quantityAvailable null) can be redeemed repeatedly", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({ category: SupplierRewardCategory.ad, campaignDurationDays: 7, creditCost: "10", quantityAvailable: null }); // S$1.00 each
    try {
      await grantEarnedCredits(company.id, "3.00");

      await redeemSupplierRewardCatalogueItem(company.id, user.id, item.id);
      await redeemSupplierRewardCatalogueItem(company.id, user.id, item.id);
      await redeemSupplierRewardCatalogueItem(company.id, user.id, item.id);

      const itemAfter = await prisma.supplierRewardCatalogueItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(itemAfter.redeemedCount, 3);

      const balanceAfter = await getCompanyEarnedBalance(company.id);
      assert.equal(balanceAfter.toString(), "0");
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });
});

describe("redeemSupplierRewardCatalogueItem — system (Tier Boost) category", () => {
  test("resolves expiresAt from the item's duration, bumps the effective tier one level, and rejects a second redemption while active", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({
      category: SupplierRewardCategory.system,
      creditCost: "10",
      upgradeDurationMonths: 3,
    });
    try {
      await grantEarnedCredits(company.id, "30.00");

      const before = Date.now();
      const first = await redeemSupplierRewardCatalogueItem(company.id, user.id, item.id);
      assert.equal(first.status, "used");
      assert.ok(first.expiresAt);
      assert.ok(first.expiresAt!.getTime() > before);

      const tierStatus = await getCompanySupplierTier(company.id);
      // A fresh company computes to `free` with no boost; with an active
      // Tier Boost, nextTier("free") = "preferred" is applied as the
      // effective tier while baseTier stays the live-computed one.
      assert.equal(tierStatus.baseTier, "free");
      assert.equal(tierStatus.tier, "preferred");
      assert.equal(tierStatus.tierBoostActive, true);

      await assert.rejects(
        () => redeemSupplierRewardCatalogueItem(company.id, user.id, item.id),
        (e: unknown) => e instanceof SupplierRewardRedemptionError && e.reason === "tier_boost_already_active"
      );
      // Only the first redemption exists; the balance was only debited once.
      const redemptions = await prisma.supplierRewardRedemption.findMany({ where: { companyId: company.id } });
      assert.equal(redemptions.length, 1);
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });
});

describe("resolveSupplierRewardRedemption", () => {
  test("marks a pending report/ad redemption `used`", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({ category: SupplierRewardCategory.ad, campaignDurationDays: 7, creditCost: "10" });
    try {
      await grantEarnedCredits(company.id, "10.00");
      const redemption = await redeemSupplierRewardCatalogueItem(company.id, user.id, item.id);
      assert.equal(redemption.status, "pending");

      const resolved = await resolveSupplierRewardRedemption(redemption.id, "used");
      assert.equal(resolved.status, "used");
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });

  test("rejects resolving an already-resolved redemption ('not_pending')", async () => {
    const company = await createCompany();
    const user = await createUser();
    const item = await createCatalogueItem({ category: SupplierRewardCategory.system, upgradeDurationMonths: 3, creditCost: "10" }); // system -> already `used`
    try {
      await grantEarnedCredits(company.id, "10.00");
      const redemption = await redeemSupplierRewardCatalogueItem(company.id, user.id, item.id);

      await assert.rejects(
        () => resolveSupplierRewardRedemption(redemption.id, "used"),
        (e: unknown) => e instanceof SupplierRewardRedemptionResolutionError && e.reason === "not_pending"
      );
    } finally {
      await cleanup(company.id, user.id, item.id);
    }
  });

  test("rejects resolving an unknown redemption id ('not_found')", async () => {
    await assert.rejects(
      () => resolveSupplierRewardRedemption(BigInt(999999999), "used"),
      (e: unknown) => e instanceof SupplierRewardRedemptionResolutionError && e.reason === "not_found"
    );
  });
});
