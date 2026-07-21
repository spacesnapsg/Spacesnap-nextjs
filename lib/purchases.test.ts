// Coverage for "Buy Now" (createPurchaseWithDebit): unlike
// createBulkOrderWithDebit (lib/bulk-orders.ts), this also has to guard on
// stock, not just credit balance, and must decrement stock atomically rather
// than leave it untouched (bulk orders never touch stock — they're a request
// the supplier fulfills manually). Hits the real dev Postgres DB through
// Prisma, same convention as lib/bulk-orders.test.ts.
//
// 2026-07-21 write-path session: rewired from the combined-ledger `topup`/
// `purchase` types to the purchased/earned split — createPurchaseWithDebit
// now checks/debits purchasedBalance specifically (purchased_topup/
// purchased_spend), not the raw combined SUM, so every balance fixture below
// seeds `purchased_topup`, not `topup`. New describe block covers
// RewardGrant (free_consumable_unit) discount redemption.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, TransactionType, RewardGrantType } from "../app/generated/prisma/client";
import { getPurchasedBalance, InsufficientCreditBalanceError } from "./credits";
import { createPurchaseWithDebit, InsufficientStockError, RewardGrantNotRedeemableError } from "./purchases";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Purchase Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Purchase Test User",
      email: `purchase-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createConsumablesListing(companyId: bigint, stockQuantity = 10, pricePerUnit = "18.50") {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.consumables,
      name: "Purchase Test Packaging",
      pricePerUnit,
      stockQuantity,
      packSize: "Pack of 50",
    },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

describe("createPurchaseWithDebit (Buy Now)", () => {
  test("rejects with InsufficientStockError when quantity exceeds stock, and writes nothing (stock unchanged)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 3); // only 3 in stock
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "1000.00" },
      });

      await assert.rejects(
        () =>
          createPurchaseWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 5,
            cost: listing.pricePerUnit!.mul(5),
            unitPrice: listing.pricePerUnit!,
          }),
        InsufficientStockError
      );

      const purchases = await prisma.purchase.findMany({ where: { userId: user.id } });
      assert.equal(purchases.length, 0);
      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 3);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects with InsufficientCreditBalanceError when stock is sufficient but purchasedBalance isn't, and rolls back the stock decrement too", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10); // plenty of stock, zero credits

      await assert.rejects(
        () =>
          createPurchaseWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 2,
            cost: listing.pricePerUnit!.mul(2), // 37.00
            unitPrice: listing.pricePerUnit!,
          }),
        InsufficientCreditBalanceError
      );

      const purchases = await prisma.purchase.findMany({ where: { userId: user.id } });
      assert.equal(purchases.length, 0);
      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 10, "stock decrement must roll back with the rest of the transaction");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("succeeds: decrements stock by quantity, debits exactly the cost from purchasedBalance, creates one Purchase row and no BulkOrderRequest", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(2); // 37.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });

      const purchase = await createPurchaseWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 2,
        cost,
        unitPrice: listing.pricePerUnit!,
      });

      assert.equal(purchase.quantity, 2);
      assert.equal(purchase.credits.toString(), "37");
      assert.equal(purchase.earnedCreditsApplied.toString(), "0");

      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 8);

      const balanceAfter = await getPurchasedBalance(user.id);
      assert.equal(balanceAfter.toString(), "63");

      const transactions = await prisma.transaction.findMany({ where: { purchaseId: purchase.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.purchased_spend);
      assert.equal(transactions[0].amount.toString(), "-37");

      const bulkOrderRequests = await prisma.bulkOrderRequest.findMany({ where: { userId: user.id } });
      assert.equal(bulkOrderRequests.length, 0, "Buy Now must not create a BulkOrderRequest row");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("succeeds exactly at the stock boundary: quantity equal to remaining stock is allowed, leaves stock at zero", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 4);
      const cost = listing.pricePerUnit!.mul(4);
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });

      await createPurchaseWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 4,
        cost,
        unitPrice: listing.pricePerUnit!,
      });

      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// 2026-07-21 — RewardGrant (free_consumable_unit) redemption against a
// purchase's discount line (Purchase.earnedCreditsApplied). No issuance flow
// exists yet, so grants are seeded directly via prisma, same as every other
// fixture in this file.
describe("createPurchaseWithDebit — RewardGrant (free_consumable_unit) redemption", () => {
  test("resolves a free_consumable_unit grant's value*unitPrice as the discount, marks the grant redeemed, and writes an earned_spend Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10, "18.50");
      const cost = listing.pricePerUnit!.mul(3); // 55.50
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.free_consumable_unit, value: "1", grantedVia: "test-fixture" },
      });

      const purchase = await createPurchaseWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 3,
        cost,
        unitPrice: listing.pricePerUnit!,
        rewardGrantId: grant.id,
      });

      // 1 free unit * 18.50/unit = 18.50 discount; charge = 55.50 - 18.50 = 37.00
      assert.equal(purchase.credits.toString(), "55.5");
      assert.equal(purchase.earnedCreditsApplied.toString(), "18.5");

      const balanceAfter = await getPurchasedBalance(user.id);
      assert.equal(balanceAfter.toString(), "63"); // 100 - 37.00

      const grantAfter = await prisma.rewardGrant.findUnique({ where: { id: grant.id } });
      assert.equal(grantAfter!.status, "redeemed");
      assert.ok(grantAfter!.redeemedAt);

      const transactions = await prisma.transaction.findMany({ where: { purchaseId: purchase.id } });
      assert.equal(transactions.length, 2);
      const earnedSpend = transactions.find((t) => t.type === TransactionType.earned_spend);
      assert.ok(earnedSpend);
      assert.equal(earnedSpend!.amount.toString(), "-18.5");
      assert.equal(earnedSpend!.rewardGrantId?.toString(), grant.id.toString());
      const purchasedSpend = transactions.find((t) => t.type === TransactionType.purchased_spend);
      assert.ok(purchasedSpend);
      assert.equal(purchasedSpend!.amount.toString(), "-37");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects an already-redeemed grant and writes nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10, "18.50");
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });
      const grant = await prisma.rewardGrant.create({
        data: {
          userId: user.id,
          type: RewardGrantType.free_consumable_unit,
          value: "1",
          status: "redeemed",
          redeemedAt: new Date(),
          grantedVia: "test-fixture",
        },
      });

      await assert.rejects(
        () =>
          createPurchaseWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 1,
            cost: listing.pricePerUnit!,
            unitPrice: listing.pricePerUnit!,
            rewardGrantId: grant.id,
          }),
        RewardGrantNotRedeemableError
      );

      const purchases = await prisma.purchase.findMany({ where: { userId: user.id } });
      assert.equal(purchases.length, 0);
      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 10);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects a grant belonging to a different user", async () => {
    const company = await createCompany();
    const user = await createUser();
    const otherUser = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10, "18.50");
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });
      const grant = await prisma.rewardGrant.create({
        data: { userId: otherUser.id, type: RewardGrantType.free_consumable_unit, value: "1", grantedVia: "test-fixture" },
      });

      await assert.rejects(
        () =>
          createPurchaseWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 1,
            cost: listing.pricePerUnit!,
            unitPrice: listing.pricePerUnit!,
            rewardGrantId: grant.id,
          }),
        RewardGrantNotRedeemableError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id, otherUser.id]);
    }
  });

  test("rejects a booking_discount_pct grant (wrong type for a purchase)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10, "18.50");
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.booking_discount_pct, value: "10", grantedVia: "test-fixture" },
      });

      await assert.rejects(
        () =>
          createPurchaseWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 1,
            cost: listing.pricePerUnit!,
            unitPrice: listing.pricePerUnit!,
            rewardGrantId: grant.id,
          }),
        RewardGrantNotRedeemableError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("clamps a grant worth more than the purchase to the full cost, never issuing a net credit", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10, "18.50");
      const cost = listing.pricePerUnit!.mul(1); // 18.50
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });
      // 5 free units worth (92.50) against a single-unit (18.50) purchase.
      const grant = await prisma.rewardGrant.create({
        data: { userId: user.id, type: RewardGrantType.free_consumable_unit, value: "5", grantedVia: "test-fixture" },
      });

      const purchase = await createPurchaseWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost,
        unitPrice: listing.pricePerUnit!,
        rewardGrantId: grant.id,
      });

      assert.equal(purchase.earnedCreditsApplied.toString(), "18.5");

      const balanceAfter = await getPurchasedBalance(user.id);
      assert.equal(balanceAfter.toString(), "100"); // fully covered by the grant, purchasedBalance untouched
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
