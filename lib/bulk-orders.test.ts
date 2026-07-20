// Coverage for the bulk-order-request lifecycle, including cancellation
// (2026-07-20 product owner request): a still-`pending` request can be
// cancelled directly by the buyer (cancelBulkOrderByUser); once `confirmed`,
// the buyer can only requestBulkOrderCancellation, which the supplier
// approves or rejects. `confirmBulkOrder` now also requires an
// `estimatedDeliveryDate` (same date). Corrected 2026-07-20: credits are
// debited only at fulfillment (fulfillBulkOrderWithDebit), not at request
// creation — matching the old SupplierBulkOrderController/
// BulkOrderRequestController split exactly. An earlier session had creation
// debit credits directly; that was wrong and this file was rewritten
// alongside the lib/bulk-orders.ts correction. Hits the real dev Postgres DB
// through Prisma (no mocking), same as lib/bookings.test.ts.
//
// 2026-07-20 credit-hold feature: confirmBulkOrder now checks the buyer's
// *available* balance (live balance minus active holds) and rejects with
// InsufficientAvailableCreditError unless `{ override: true }` is passed —
// see lib/credit-holds.test.ts for that behavior's own coverage. None of
// these buyers top up before confirming (that's not what these tests are
// about), so every confirmBulkOrder call here passes `{ override: true }`
// to keep testing the status/ownership rules these tests actually cover,
// not the credit check.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, TransactionType } from "../app/generated/prisma/client";
import { getCreditBalance, InsufficientCreditBalanceError } from "./credits";
import {
  createBulkOrder,
  confirmBulkOrder,
  BulkOrderNotConfirmableError,
  declineBulkOrder,
  BulkOrderNotDeclinableError,
  fulfillBulkOrderWithDebit,
  BulkOrderNotFulfillableError,
  cancelBulkOrderByUser,
  BulkOrderNotOwnedError,
  BulkOrderNotCancellableError,
  requestBulkOrderCancellation,
  BulkOrderCancellationNotRequestableError,
  approveBulkOrderCancellation,
  rejectBulkOrderCancellation,
  BulkOrderCancellationNotPendingError,
} from "./bulk-orders";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SAMPLE_DELIVERY_DATE = new Date("2027-01-15T00:00:00.000Z");

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

describe("createBulkOrder", () => {
  test("creates a pending request with no balance check and no Transaction, even with zero credits", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50

      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 5,
        cost: listing.pricePerUnit!.mul(5), // 92.50
      });

      assert.equal(bulkOrderRequest.status, "pending");
      assert.equal(bulkOrderRequest.credits.toString(), "92.5");

      const balance = await getCreditBalance(user.id);
      assert.equal(balance.toString(), "0");

      const transactions = await prisma.transaction.findMany({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(transactions.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("snapshots the cost at creation time, quantity and price included", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(3); // 55.50

      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 3,
        cost,
      });

      assert.equal(bulkOrderRequest.credits.toString(), "55.5");
      assert.equal(bulkOrderRequest.quantity, 3);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("confirmBulkOrder", () => {
  test("confirms a pending request, stores the estimated delivery date, and writes no Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 2,
        cost: listing.pricePerUnit!.mul(2),
      });

      const updated = await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });
      assert.equal(updated.status, "confirmed");
      assert.equal(updated.estimatedDeliveryDate?.toISOString(), SAMPLE_DELIVERY_DATE.toISOString());

      const transactions = await prisma.transaction.findMany({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(transactions.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("confirming an already-confirmed request rejects cleanly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });

      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });
      await assert.rejects(() => confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true }), BulkOrderNotConfirmableError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("declineBulkOrder", () => {
  test("declines a pending request with no refund Transaction, since nothing was ever debited", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 2,
        cost: listing.pricePerUnit!.mul(2),
      });

      const updated = await declineBulkOrder(bulkOrderRequest.id);
      assert.equal(updated.status, "cancelled");

      const balance = await getCreditBalance(user.id);
      assert.equal(balance.toString(), "0");

      const transactions = await prisma.transaction.findMany({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(transactions.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a confirmed request can still be declined", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });

      const updated = await declineBulkOrder(bulkOrderRequest.id);
      assert.equal(updated.status, "cancelled");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("declining an already-cancelled request rejects cleanly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });

      await declineBulkOrder(bulkOrderRequest.id);
      await assert.rejects(() => declineBulkOrder(bulkOrderRequest.id), BulkOrderNotDeclinableError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("fulfillBulkOrderWithDebit", () => {
  test("rejects with InsufficientCreditBalanceError when the requester has no credits, and writes nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 5,
        cost: listing.pricePerUnit!.mul(5), // 92.50
      });

      await assert.rejects(() => fulfillBulkOrderWithDebit(bulkOrderRequest.id), InsufficientCreditBalanceError);

      const requestRow = await prisma.bulkOrderRequest.findUnique({ where: { id: bulkOrderRequest.id } });
      assert.equal(requestRow!.status, "pending");

      const transactions = await prisma.transaction.findMany({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
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
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 2, cost });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "36.99" },
      });

      await assert.rejects(() => fulfillBulkOrderWithDebit(bulkOrderRequest.id), InsufficientCreditBalanceError);

      const requestRow = await prisma.bulkOrderRequest.findUnique({ where: { id: bulkOrderRequest.id } });
      assert.equal(requestRow!.status, "pending");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("succeeds when balance exactly matches cost: balance decremented to zero, status fulfilled, one debit Transaction row of type purchase", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(4); // 74.00
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 4, cost });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "74.00" },
      });

      const updated = await fulfillBulkOrderWithDebit(bulkOrderRequest.id);
      assert.equal(updated.status, "fulfilled");

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

  test("a confirmed request can be fulfilled directly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(3); // 55.50
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 3, cost });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "100.00" },
      });

      const updated = await fulfillBulkOrderWithDebit(bulkOrderRequest.id);
      assert.equal(updated.status, "fulfilled");

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "44.5");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("fulfilling an already-fulfilled request rejects cleanly, no double debit", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id); // pricePerUnit 18.50
      const cost = listing.pricePerUnit!.mul(1);
      const bulkOrderRequest = await createBulkOrder({ userId: user.id, listingId: listing.id, quantity: 1, cost });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "100.00" },
      });

      await fulfillBulkOrderWithDebit(bulkOrderRequest.id);
      await assert.rejects(() => fulfillBulkOrderWithDebit(bulkOrderRequest.id), BulkOrderNotFulfillableError);

      const transactions = await prisma.transaction.findMany({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(transactions.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("fulfilling a cancelled request rejects cleanly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await declineBulkOrder(bulkOrderRequest.id);

      await assert.rejects(() => fulfillBulkOrderWithDebit(bulkOrderRequest.id), BulkOrderNotFulfillableError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("cancelBulkOrderByUser", () => {
  test("the requester can cancel their own pending request", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });

      const updated = await cancelBulkOrderByUser(bulkOrderRequest.id, user.id);
      assert.equal(updated.status, "cancelled");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a different user cannot cancel someone else's request", async () => {
    const company = await createCompany();
    const owner = await createUser();
    const impostor = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: owner.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });

      await assert.rejects(() => cancelBulkOrderByUser(bulkOrderRequest.id, impostor.id), BulkOrderNotOwnedError);

      const requestRow = await prisma.bulkOrderRequest.findUnique({ where: { id: bulkOrderRequest.id } });
      assert.equal(requestRow!.status, "pending");
    } finally {
      await cleanupCompanyAndUsers(company.id, [owner.id, impostor.id]);
    }
  });

  test("a confirmed request cannot be cancelled directly by the user — must request cancellation instead", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });

      await assert.rejects(() => cancelBulkOrderByUser(bulkOrderRequest.id, user.id), BulkOrderNotCancellableError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("requestBulkOrderCancellation", () => {
  test("the requester can request cancellation of a confirmed order, with a reason", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });

      const updated = await requestBulkOrderCancellation(bulkOrderRequest.id, user.id, "No longer needed");
      assert.equal(updated.status, "confirmed");
      assert.equal(updated.cancellationReason, "No longer needed");
      assert.ok(updated.cancellationRequestedAt);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cannot request cancellation of a still-pending request — must cancel directly instead", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });

      await assert.rejects(
        () => requestBulkOrderCancellation(bulkOrderRequest.id, user.id, "reason"),
        BulkOrderCancellationNotRequestableError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cannot submit a second cancellation request while one is already pending", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });
      await requestBulkOrderCancellation(bulkOrderRequest.id, user.id, "first reason");

      await assert.rejects(
        () => requestBulkOrderCancellation(bulkOrderRequest.id, user.id, "second reason"),
        BulkOrderCancellationNotRequestableError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a different user cannot request cancellation of someone else's request", async () => {
    const company = await createCompany();
    const owner = await createUser();
    const impostor = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: owner.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });

      await assert.rejects(
        () => requestBulkOrderCancellation(bulkOrderRequest.id, impostor.id, "reason"),
        BulkOrderNotOwnedError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [owner.id, impostor.id]);
    }
  });
});

describe("approveBulkOrderCancellation / rejectBulkOrderCancellation", () => {
  test("approving moves the order to cancelled and clears the cancellation fields", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });
      await requestBulkOrderCancellation(bulkOrderRequest.id, user.id, "reason");

      const updated = await approveBulkOrderCancellation(bulkOrderRequest.id);
      assert.equal(updated.status, "cancelled");
      assert.equal(updated.cancellationRequestedAt, null);
      assert.equal(updated.cancellationReason, null);

      const transactions = await prisma.transaction.findMany({ where: { bulkOrderRequestId: bulkOrderRequest.id } });
      assert.equal(transactions.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejecting clears the cancellation fields but leaves the order confirmed", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });
      await requestBulkOrderCancellation(bulkOrderRequest.id, user.id, "reason");

      const updated = await rejectBulkOrderCancellation(bulkOrderRequest.id);
      assert.equal(updated.status, "confirmed");
      assert.equal(updated.cancellationRequestedAt, null);
      assert.equal(updated.cancellationReason, null);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("approving with no pending cancellation request rejects cleanly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });

      await assert.rejects(() => approveBulkOrderCancellation(bulkOrderRequest.id), BulkOrderCancellationNotPendingError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejecting with no pending cancellation request rejects cleanly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createConsumablesListing(company.id);
      const bulkOrderRequest = await createBulkOrder({
        userId: user.id,
        listingId: listing.id,
        quantity: 1,
        cost: listing.pricePerUnit!,
      });
      await confirmBulkOrder(bulkOrderRequest.id, SAMPLE_DELIVERY_DATE, { override: true });

      await assert.rejects(() => rejectBulkOrderCancellation(bulkOrderRequest.id), BulkOrderCancellationNotPendingError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
