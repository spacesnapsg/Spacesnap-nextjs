// Coverage for lib/buyer-org-spend-requests.ts (2026-07-28 "Buyer Org pool —
// delegated spend") — the request-and-fulfillment lifecycle for a member
// without buyerOrgCanBook/buyerOrgCanPurchase: create (member) ->
// fulfill/decline (admin). fulfillBuyerOrgSpendRequest mirrors POST
// /api/bookings and POST /api/purchases' own checks (cert gating, overlap,
// pricing), so this suite also exercises those against real fixtures. Real
// dev/test Postgres DB via Prisma, same convention as every other
// lib/*.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, TransactionType } from "../app/generated/prisma/client";
import {
  parseSpendRequestFields,
  createBuyerOrgSpendRequest,
  fulfillBuyerOrgSpendRequest,
  declineBuyerOrgSpendRequest,
  BuyerOrgSpendRequestNotPendingError,
} from "./buyer-org-spend-requests";
import { NotBuyerOrgAdminError } from "./buyer-organizations";
import { getBuyerOrgPoolBalance } from "./credits";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser(overrides: Partial<{ buyerOrganizationId: bigint; isBuyerOrgAdmin: boolean }> = {}) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Spend Request Test User",
      email: `spend-request-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
      ...overrides,
    },
  });
}

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({ data: { name: `Spend Request Test Co ${Date.now()}-${companyCounter}` } });
}

function createSpaceListing(companyId: bigint) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Spend Request Test Listing",
      priceDay: "10.00",
      priceWeek: "60.00",
      priceMonth: "200.00",
    },
  });
}

function createConsumablesListing(companyId: bigint, stockQuantity = 10, pricePerUnit = "18.50") {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.consumables,
      name: "Spend Request Test Packaging",
      pricePerUnit,
      stockQuantity,
      packSize: "Pack of 50",
    },
  });
}

async function cleanup(companyId: bigint, userIds: string[], orgId: bigint) {
  await prisma.adminNotification.deleteMany({ where: { relatedUserId: { in: userIds } } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.buyerOrganization.delete({ where: { id: orgId } }).catch(() => {});
}

describe("parseSpendRequestFields", () => {
  test("accepts a valid booking body", () => {
    const fields = parseSpendRequestFields({
      type: "booking",
      listingId: "1",
      bookingType: "daily",
      startDate: "2027-11-01",
      endDate: "2027-11-01",
    });
    assert.equal(fields.type, "booking");
  });

  test("accepts a valid consumable_purchase body", () => {
    const fields = parseSpendRequestFields({ type: "consumable_purchase", listingId: "1", quantity: 3 });
    assert.equal(fields.type, "consumable_purchase");
  });

  test("rejects a missing/invalid type", () => {
    assert.throws(() => parseSpendRequestFields({ listingId: "1" }), ApiValidationError);
  });

  test("rejects a booking body missing dates", () => {
    assert.throws(
      () => parseSpendRequestFields({ type: "booking", listingId: "1", bookingType: "daily" }),
      ApiValidationError
    );
  });
});

describe("createBuyerOrgSpendRequest + fulfillBuyerOrgSpendRequest — booking (real DB)", () => {
  test("member creates a request, admin fulfills it: books under the member's own account, funded by the pool, no Stripe charge", async () => {
    const company = await createCompany();
    const org = await prisma.buyerOrganization.create({ data: { name: `Spend Request Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      await prisma.transaction.create({
        data: { userId: admin.id, buyerOrganizationId: org.id, type: TransactionType.purchased_topup, amount: "50.00" },
      });

      const created = await createBuyerOrgSpendRequest(member.id, org.id, {
        type: "booking",
        listingId: listing.id,
        bookingType: "daily",
        startDate: "2027-11-05",
        endDate: "2027-11-05",
      });
      assert.equal(created.status, "pending");

      // Admin gets notified.
      const adminNotifications = await prisma.notification.findMany({ where: { userId: admin.id, type: "buyer_org_spend_request" } });
      assert.equal(adminNotifications.length, 1);

      const { request, booking } = await fulfillBuyerOrgSpendRequest(admin.id, created.id);
      assert.equal(request.status, "fulfilled");
      assert.ok(booking);
      assert.equal(booking!.userId, member.id); // belongs to the requesting member, not the admin
      // Marked up by the platform's default daily markup (50%) same as the
      // direct booking route — 10 base -> 15 charged (getEffectiveCompanyPricing).
      assert.equal(booking!.sgdAmount.toString(), "15");

      // requireApproval defaults false on this fixture's listing, so the
      // booking auto-confirms — same as the direct booking route, that adds
      // a second zero-amount "booking" audit Transaction alongside the real
      // debit (createBookingWithDebit's own auto-confirm audit trail).
      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking!.id } });
      assert.equal(transactions.length, 2);
      const debit = transactions.find((t) => t.type === TransactionType.booking_payment);
      assert.ok(debit);
      assert.equal(debit!.amount.toString(), "-15");
      assert.equal(debit!.stripePaymentIntentId, null);
      assert.equal(debit!.buyerOrganizationId?.toString(), org.id.toString());

      const poolBalance = await getBuyerOrgPoolBalance(org.id);
      assert.equal(poolBalance.toString(), "35"); // 50 - 15

      // Requester gets notified of the approval — alongside the auto-confirm
      // notification createBookingWithDebit itself already writes (same
      // requireApproval:false path as a direct booking), so there are two
      // Notification rows tied to this booking, not a bug.
      const memberNotifications = await prisma.notification.findMany({ where: { userId: member.id, relatedBookingId: booking!.id } });
      assert.equal(memberNotifications.length, 2);
      assert.ok(memberNotifications.some((n) => n.title === "Booking request approved"));
    } finally {
      await cleanup(company.id, [admin.id, member.id], org.id);
    }
  });

  test("a non-admin cannot fulfill a request", async () => {
    const company = await createCompany();
    const org = await prisma.buyerOrganization.create({ data: { name: `Spend Request Org ${Date.now()}` } });
    const plain = await createUser({ buyerOrganizationId: org.id });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const listing = await createSpaceListing(company.id);
      const created = await createBuyerOrgSpendRequest(member.id, org.id, {
        type: "booking",
        listingId: listing.id,
        bookingType: "daily",
        startDate: "2027-11-06",
        endDate: "2027-11-06",
      });

      await assert.rejects(() => fulfillBuyerOrgSpendRequest(plain.id, created.id), NotBuyerOrgAdminError);
    } finally {
      await cleanup(company.id, [plain.id, member.id], org.id);
    }
  });

  test("fulfilling an already-resolved request rejects cleanly", async () => {
    const company = await createCompany();
    const org = await prisma.buyerOrganization.create({ data: { name: `Spend Request Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.transaction.create({
        data: { userId: admin.id, buyerOrganizationId: org.id, type: TransactionType.purchased_topup, amount: "50.00" },
      });
      const created = await createBuyerOrgSpendRequest(member.id, org.id, {
        type: "booking",
        listingId: listing.id,
        bookingType: "daily",
        startDate: "2027-11-07",
        endDate: "2027-11-07",
      });

      await fulfillBuyerOrgSpendRequest(admin.id, created.id);
      await assert.rejects(() => fulfillBuyerOrgSpendRequest(admin.id, created.id), BuyerOrgSpendRequestNotPendingError);
    } finally {
      await cleanup(company.id, [admin.id, member.id], org.id);
    }
  });

  test("declineBuyerOrgSpendRequest marks it declined, notifies the requester, moves no money", async () => {
    const company = await createCompany();
    const org = await prisma.buyerOrganization.create({ data: { name: `Spend Request Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const listing = await createSpaceListing(company.id);
      const created = await createBuyerOrgSpendRequest(member.id, org.id, {
        type: "booking",
        listingId: listing.id,
        bookingType: "daily",
        startDate: "2027-11-08",
        endDate: "2027-11-08",
      });

      const declined = await declineBuyerOrgSpendRequest(admin.id, created.id, "Not in budget this month");
      assert.equal(declined.status, "declined");
      assert.equal(declined.declineReason, "Not in budget this month");

      const bookings = await prisma.booking.findMany({ where: { userId: member.id } });
      assert.equal(bookings.length, 0);

      const memberNotifications = await prisma.notification.findMany({ where: { userId: member.id } });
      assert.equal(memberNotifications.length, 1);
      assert.match(memberNotifications[0].message, /Not in budget this month/);
    } finally {
      await cleanup(company.id, [admin.id, member.id], org.id);
    }
  });
});

describe("createBuyerOrgSpendRequest + fulfillBuyerOrgSpendRequest — consumable_purchase (real DB)", () => {
  test("member creates a purchase request, admin fulfills it: purchase under the member's own account, funded by the pool", async () => {
    const company = await createCompany();
    const org = await prisma.buyerOrganization.create({ data: { name: `Spend Request Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const listing = await createConsumablesListing(company.id, 10, "18.50");
      await prisma.transaction.create({
        data: { userId: admin.id, buyerOrganizationId: org.id, type: TransactionType.purchased_topup, amount: "100.00" },
      });

      const created = await createBuyerOrgSpendRequest(member.id, org.id, {
        type: "consumable_purchase",
        listingId: listing.id,
        quantity: 2,
      });

      const { request, purchase } = await fulfillBuyerOrgSpendRequest(admin.id, created.id);
      assert.equal(request.status, "fulfilled");
      assert.ok(purchase);
      assert.equal(purchase!.userId, member.id);
      assert.equal(purchase!.credits.toString(), "37");

      const stockAfter = await prisma.listing.findUnique({ where: { id: listing.id } });
      assert.equal(stockAfter!.stockQuantity, 8);

      const poolBalance = await getBuyerOrgPoolBalance(org.id);
      assert.equal(poolBalance.toString(), "63");
    } finally {
      await cleanup(company.id, [admin.id, member.id], org.id);
    }
  });

  test("createBuyerOrgSpendRequest rejects a booking request against a consumables listing", async () => {
    const company = await createCompany();
    const org = await prisma.buyerOrganization.create({ data: { name: `Spend Request Org ${Date.now()}` } });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const listing = await createConsumablesListing(company.id);
      await assert.rejects(
        () =>
          createBuyerOrgSpendRequest(member.id, org.id, {
            type: "booking",
            listingId: listing.id,
            bookingType: "daily",
            startDate: "2027-11-09",
            endDate: "2027-11-09",
          }),
        ApiValidationError
      );
    } finally {
      await cleanup(company.id, [member.id], org.id);
    }
  });
});
