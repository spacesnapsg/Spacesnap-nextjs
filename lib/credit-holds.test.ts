// Credit-hold feature (2026-07-20, product owner scope): confirming a bulk
// order places a hold on the buyer's available credit (checked, not just
// live ledger balance) rather than debiting anything — the real debit still
// only happens at fulfillment (fulfillBulkOrderWithDebit, lib/bulk-orders.ts).
// Hits the real dev Postgres DB through Prisma (no mocking), same convention
// as lib/bulk-orders.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, TransactionType, CreditHoldStatus } from "../app/generated/prisma/client";
import { getCreditBalance } from "./credits";
import { getAvailableCreditBalance, InsufficientAvailableCreditError } from "./credit-holds";
import {
  createBulkOrder,
  confirmBulkOrder,
  fulfillBulkOrderWithDebit,
  declineBulkOrder,
  requestBulkOrderCancellation,
  approveBulkOrderCancellation,
} from "./bulk-orders";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SAMPLE_DELIVERY_DATE = new Date("2027-01-15T00:00:00.000Z");

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({ data: { name: `Credit Hold Test Co ${Date.now()}-${companyCounter}` } });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: { name: "Credit Hold Test User", email: `credit-hold-test-${Date.now()}-${userCounter}@example.com`, password: "x" },
  });
}

function createConsumablesListing(companyId: bigint, pricePerUnit = "20.00") {
  return prisma.listing.create({
    data: { companyId, type: ListingType.consumables, name: "Credit Hold Test Packaging", pricePerUnit, stockQuantity: 400, packSize: "Pack of 50" },
  });
}

async function topUp(userId: string, amount: string) {
  await prisma.transaction.create({ data: { userId, type: TransactionType.topup, amount } });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

describe("getAvailableCreditBalance", () => {
  test("with no transactions and no holds, balance/held/available are all zero", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const result = await getAvailableCreditBalance(user.id);
      assert.equal(result.balance.toString(), "0");
      assert.equal(result.held.toString(), "0");
      assert.equal(result.available.toString(), "0");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("an active hold reduces available balance but not the live ledger balance", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "100.00");
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! }); // 20
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE);

      const result = await getAvailableCreditBalance(user.id);
      assert.equal(result.balance.toString(), "100");
      assert.equal(result.held.toString(), "20");
      assert.equal(result.available.toString(), "80");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("an expired hold is lazily released and excluded from held/available", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "100.00");
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! });
      // Manufacture an already-expired hold directly (createHold always sets
      // a 7-day-future expiry) to exercise the lazy-release path without
      // waiting a week.
      await prisma.creditHold.create({
        data: { userId: user.id, bulkOrderRequestId: bulkOrderRequest.id, amount: "20.00", expiresAt: new Date(Date.now() - 1000) },
      });

      const result = await getAvailableCreditBalance(user.id);
      assert.equal(result.held.toString(), "0");
      assert.equal(result.available.toString(), "100");

      const hold = await prisma.creditHold.findUnique({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(hold!.status, CreditHoldStatus.released);
      assert.ok(hold!.releasedAt);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("confirmBulkOrder credit-hold behavior", () => {
  test("confirming with sufficient available balance creates an active hold, no override log", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "50.00");
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! }); // 20

      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE);

      const hold = await prisma.creditHold.findUnique({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(hold!.status, CreditHoldStatus.active);
      assert.equal(hold!.amount.toString(), "20");

      const overrideLogs = await prisma.activityLog.findMany({
        where: { userId: user.id, actionType: "bulk_order_confirmed_despite_insufficient_credit" },
      });
      assert.equal(overrideLogs.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("confirming with insufficient available balance and no override rejects, writes nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // zero balance
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! }); // 20

      await assert.rejects(() => confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE), InsufficientAvailableCreditError);

      const requestRow = await prisma.bulkOrderRequest.findUnique({ where: { id: bulkOrderRequest.id } });
      assert.equal(requestRow!.status, "pending");

      const hold = await prisma.creditHold.findUnique({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(hold, null);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("confirming with insufficient available balance and override:true succeeds, holds anyway, logs the override", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // zero balance
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! }); // 20

      const updated = await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });
      assert.equal(updated.status, "confirmed");

      const hold = await prisma.creditHold.findUnique({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(hold!.status, CreditHoldStatus.active);
      assert.equal(hold!.amount.toString(), "20");

      const overrideLogs = await prisma.activityLog.findMany({
        where: { userId: user.id, actionType: "bulk_order_confirmed_despite_insufficient_credit" },
      });
      assert.equal(overrideLogs.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a second confirmed order is blocked by the first order's hold, even though the ledger balance alone would cover it", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "30.00");
      const listing = await createConsumablesListing(company.id); // 20 each
      const first = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! });
      const second = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! });

      await confirmBulkOrder(first.id, SAMPLE_DELIVERY_DATE); // holds 20, leaves 10 available
      await assert.rejects(() => confirmBulkOrder(second.id, SAMPLE_DELIVERY_DATE), InsufficientAvailableCreditError);

      const secondRow = await prisma.bulkOrderRequest.findUnique({ where: { id: second.id } });
      assert.equal(secondRow!.status, "pending");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("hold release points", () => {
  test("fulfilling releases the hold", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "50.00");
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE);

      await fulfillBulkOrderWithDebit(bulkOrderRequest.id);

      const hold = await prisma.creditHold.findUnique({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(hold!.status, CreditHoldStatus.released);
      assert.ok(hold!.releasedAt);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("declining a confirmed order releases the hold", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "50.00");
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE);

      await declineBulkOrder(bulkOrderRequest.id);

      const hold = await prisma.creditHold.findUnique({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(hold!.status, CreditHoldStatus.released);

      const result = await getAvailableCreditBalance(user.id);
      assert.equal(result.available.toString(), "50");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("approving a cancellation request releases the hold", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "50.00");
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE);
      await requestBulkOrderCancellation(bulkOrderRequest.id, user.id, "no longer needed");

      await approveBulkOrderCancellation(bulkOrderRequest.id);

      const hold = await prisma.creditHold.findUnique({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(hold!.status, CreditHoldStatus.released);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("getCreditBalance is unaffected by holds", () => {
  test("the raw ledger balance stays the full amount regardless of active holds", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      await topUp(user.id, "50.00");
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost: listing.pricePerUnit! });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE);

      const balance = await getCreditBalance(user.id);
      assert.equal(balance.toString(), "50");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
