// Coverage for "Buy Now" (createPurchaseWithDebit): unlike
// createBulkOrderWithDebit (lib/bulk-orders.ts), this also has to guard on
// stock, not just credit balance, and must decrement stock atomically rather
// than leave it untouched (bulk orders never touch stock — they're a request
// the supplier fulfills manually). Hits the real dev Postgres DB through
// Prisma, same convention as lib/bulk-orders.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, TransactionType } from "../app/generated/prisma/client";
import { getCreditBalance, InsufficientCreditBalanceError } from "./credits";
import { createPurchaseWithDebit, InsufficientStockError } from "./purchases";

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
        data: { userId: user.id, type: TransactionType.topup, amount: "1000.00" },
      });

      await assert.rejects(
        () =>
          createPurchaseWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 5,
            cost: listing.pricePerUnit!.mul(5),
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

  test("rejects with InsufficientCreditBalanceError when stock is sufficient but credits aren't, and rolls back the stock decrement too", async () => {
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

  test("succeeds: decrements stock by quantity, debits exactly the cost, creates one Purchase row and no BulkOrderRequest", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id, 10); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(2); // 37.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "100.00" },
      });

      const purchase = await createPurchaseWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 2,
        cost,
      });

      assert.equal(purchase.quantity, 2);
      assert.equal(purchase.credits.toString(), "37");

      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 8);

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "63");

      const transactions = await prisma.transaction.findMany({ where: { purchaseId: purchase.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.purchase);
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
        data: { userId: user.id, type: TransactionType.topup, amount: "100.00" },
      });

      await createPurchaseWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 4,
        cost,
      });

      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
