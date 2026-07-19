// Coverage for the Sprint 3.5 known-gap #4 ledger gap: balance check,
// BulkOrderRequest insert, and debit Transaction row all inside one DB
// transaction (createBulkOrderWithDebit), reusing the same
// assertSufficientBalance helper (lib/credits.ts) createBookingWithDebit
// uses. Hits the real dev Postgres DB through Prisma (no mocking), same as
// lib/bookings.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, TransactionType } from "../app/generated/prisma/client";
import { getCreditBalance, InsufficientCreditBalanceError } from "./credits";
import { createBulkOrderWithDebit } from "./bulk-orders";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Bulk Order Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Bulk Order Test User",
      email: `bulk-order-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createConsumablesListing(companyId: bigint, pricePerUnit = "18.50") {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.consumables,
      name: "Bulk Order Test Packaging",
      pricePerUnit,
      stockQuantity: 400,
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

describe("createBulkOrderWithDebit (Sprint 3.5, known gap #4)", () => {
  test("rejects with InsufficientCreditBalanceError when the user has no credits, and writes nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50

      await assert.rejects(
        () =>
          createBulkOrderWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 5,
            cost: listing.pricePerUnit!.mul(5), // 92.50
          }),
        InsufficientCreditBalanceError
      );

      const requests = await prisma.bulkOrderRequest.findMany({ where: { userId: user.id } });
      assert.equal(requests.length, 0);
      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects when the balance is short by any amount, even just below the cost", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(2); // 37.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "36.99" },
      });

      await assert.rejects(
        () =>
          createBulkOrderWithDebit({
            userId: user.id,
            listingId: listing.id,
            quantity: 2,
            cost,
          }),
        InsufficientCreditBalanceError
      );

      const requests = await prisma.bulkOrderRequest.findMany({ where: { userId: user.id } });
      assert.equal(requests.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("succeeds when balance exactly matches cost: balance decremented to zero, one debit Transaction row of type purchase", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(4); // 74.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "74.00" },
      });

      const bulkOrderRequest = await createBulkOrderWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 4,
        cost,
      });

      assert.equal(bulkOrderRequest.credits.toString(), "74");
      assert.equal(bulkOrderRequest.status, "pending");

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "0");

      const transactions = await prisma.transaction.findMany({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.purchase);
      assert.equal(transactions[0].amount.toString(), "-74");
      assert.equal(transactions[0].userId, user.id);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("succeeds with balance to spare: balance decremented by exactly the cost, exactly one Transaction row created", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(3); // 55.50
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "100.00" },
      });
      const balanceBefore = await getCreditBalance(user.id);
      assert.equal(balanceBefore.toString(), "100");

      const bulkOrderRequest = await createBulkOrderWithDebit({
        userId: user.id,
        listingId: listing.id,
        quantity: 3,
        cost,
      });

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "44.5");

      const requestRow = await prisma.bulkOrderRequest.findUnique({ where: { id: bulkOrderRequest.id } });
      assert.ok(requestRow);
      assert.equal(requestRow!.credits.toString(), "55.5");
      assert.equal(requestRow!.quantity, 3);

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 2); // the topup + the debit
      const debit = transactions.find((t) => t.type === TransactionType.purchase);
      assert.ok(debit);
      assert.equal(debit!.bulkOrderRequestId?.toString(), bulkOrderRequest.id.toString());
      assert.equal(debit!.amount.toString(), "-55.5");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
