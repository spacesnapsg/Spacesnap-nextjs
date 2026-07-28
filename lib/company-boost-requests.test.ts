// Coverage for lib/company-boost-requests.ts (2026-07-28 "Boost catalogue —
// delegated spend") — the request-and-fulfillment lifecycle for a member
// without companyCanPurchaseBoosts: create (member) -> fulfill/decline
// (admin). fulfillCompanyBoostRequest calls the exact same purchaseBumps/
// purchaseAndApplyPin the direct-purchase routes call, so this suite also
// asserts the ledger debit happens exactly once. Real dev/test Postgres DB
// via Prisma, same convention as lib/buyer-org-spend-requests.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient, ListingType } from "../app/generated/prisma/client";
import {
  parseCompanyBoostRequestFields,
  createCompanyBoostRequest,
  fulfillCompanyBoostRequest,
  declineCompanyBoostRequest,
  CompanyBoostRequestNotPendingError,
  ListingNotFoundError,
  InsufficientCompanyPurchasedBalanceError,
} from "./company-boost-requests";
import { NotCompanyAdminError } from "./company-membership";
import { getCompanyPurchasedBalance, createCompanyTopUp } from "./company-credits";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({ data: { name: `Boost Request Test Co ${Date.now()}-${companyCounter}` } });
}

let userCounter = 0;
async function createUser(overrides: Partial<{ companyId: bigint; isCompanyAdmin: boolean }> = {}) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Boost Request Test User",
      email: `boost-request-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
      isSupplier: true,
      ...overrides,
    },
  });
}

function createSpaceListing(companyId: bigint, isAvailable = true) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Boost Request Test Listing",
      priceDay: "10.00",
      priceWeek: "60.00",
      priceMonth: "200.00",
      isAvailable,
    },
  });
}

async function topUp(companyId: bigint, userId: string, amountSgd: string) {
  await createCompanyTopUp(companyId, userId, new Prisma.Decimal(amountSgd));
}

async function cleanup(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {}); // cascades company_transactions/company_boost_requests
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
}

describe("parseCompanyBoostRequestFields", () => {
  test("accepts a valid bump body", () => {
    const fields = parseCompanyBoostRequestFields({ type: "bump", quantity: 3 });
    assert.equal(fields.type, "bump");
  });

  test("accepts a valid pin body", () => {
    const fields = parseCompanyBoostRequestFields({ type: "pin", listingId: "1", durationDays: 7 });
    assert.equal(fields.type, "pin");
  });

  test("rejects a missing/invalid type", () => {
    assert.throws(() => parseCompanyBoostRequestFields({ quantity: 1 }), ApiValidationError);
  });

  test("rejects a bump body with a non-positive quantity", () => {
    assert.throws(() => parseCompanyBoostRequestFields({ type: "bump", quantity: 0 }), ApiValidationError);
  });

  test("rejects a pin body with an invalid durationDays", () => {
    assert.throws(
      () => parseCompanyBoostRequestFields({ type: "pin", listingId: "1", durationDays: 14 }),
      ApiValidationError
    );
  });
});

describe("createCompanyBoostRequest + fulfillCompanyBoostRequest — bump (real DB)", () => {
  test("member creates a request, admin fulfills it: bumpsAvailable increments, ledger debited under the requester's own userId", async () => {
    const company = await createCompany();
    const admin = await createUser({ companyId: company.id, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id });
    try {
      await topUp(company.id, admin.id, "50.00");

      const created = await createCompanyBoostRequest(member.id, company.id, { type: "bump", quantity: 2 });
      assert.equal(created.status, "pending");

      const adminNotifications = await prisma.notification.findMany({
        where: { userId: admin.id, type: "company_boost_request" },
      });
      assert.equal(adminNotifications.length, 1);

      const fulfilled = await fulfillCompanyBoostRequest(admin.id, created.id);
      assert.equal(fulfilled.status, "fulfilled");
      assert.equal(fulfilled.resolvedByUserId, admin.id);

      const companyAfter = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
      assert.equal(companyAfter.bumpsAvailable, 2);

      // 2 Bumps * 50 credits (BUMP_UNIT_COST_CREDITS) = 100 credits = SGD 10
      // (CREDITS_PER_SGD = 10, lib/credit-units.ts).
      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), "40"); // 50 - 10

      const debit = await prisma.companyTransaction.findFirst({ where: { companyId: company.id, userId: member.id } });
      assert.ok(debit); // attributed to the requesting member, not the admin

      const memberNotifications = await prisma.notification.findMany({ where: { userId: member.id } });
      assert.equal(memberNotifications.length, 1);
      assert.match(memberNotifications[0].message, /2 Bumps purchased/);
    } finally {
      await cleanup(company.id, [admin.id, member.id]);
    }
  });

  test("fulfilling with an insufficient balance leaves the request pending and touches no ledger row", async () => {
    const company = await createCompany();
    const admin = await createUser({ companyId: company.id, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id });
    try {
      const created = await createCompanyBoostRequest(member.id, company.id, { type: "bump", quantity: 100 });

      await assert.rejects(
        () => fulfillCompanyBoostRequest(admin.id, created.id),
        InsufficientCompanyPurchasedBalanceError
      );

      const stillPending = await prisma.companyBoostRequest.findUniqueOrThrow({ where: { id: created.id } });
      assert.equal(stillPending.status, "pending");

      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), "0");
    } finally {
      await cleanup(company.id, [admin.id, member.id]);
    }
  });

  test("a non-admin cannot fulfill a request", async () => {
    const company = await createCompany();
    const plain = await createUser({ companyId: company.id });
    const member = await createUser({ companyId: company.id });
    try {
      const created = await createCompanyBoostRequest(member.id, company.id, { type: "bump", quantity: 1 });
      await assert.rejects(() => fulfillCompanyBoostRequest(plain.id, created.id), NotCompanyAdminError);
    } finally {
      await cleanup(company.id, [plain.id, member.id]);
    }
  });

  test("fulfilling an already-resolved request rejects cleanly", async () => {
    const company = await createCompany();
    const admin = await createUser({ companyId: company.id, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id });
    try {
      await topUp(company.id, admin.id, "50.00");
      const created = await createCompanyBoostRequest(member.id, company.id, { type: "bump", quantity: 1 });

      await fulfillCompanyBoostRequest(admin.id, created.id);
      await assert.rejects(
        () => fulfillCompanyBoostRequest(admin.id, created.id),
        CompanyBoostRequestNotPendingError
      );
    } finally {
      await cleanup(company.id, [admin.id, member.id]);
    }
  });

  test("declineCompanyBoostRequest marks it declined, notifies the requester, moves no money", async () => {
    const company = await createCompany();
    const admin = await createUser({ companyId: company.id, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id });
    try {
      await topUp(company.id, admin.id, "50.00");
      const created = await createCompanyBoostRequest(member.id, company.id, { type: "bump", quantity: 1 });

      const declined = await declineCompanyBoostRequest(admin.id, created.id, "Not this month");
      assert.equal(declined.status, "declined");
      assert.equal(declined.declineReason, "Not this month");

      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), "50"); // untouched

      const memberNotifications = await prisma.notification.findMany({ where: { userId: member.id } });
      assert.equal(memberNotifications.length, 1);
      assert.match(memberNotifications[0].message, /Not this month/);
    } finally {
      await cleanup(company.id, [admin.id, member.id]);
    }
  });
});

describe("createCompanyBoostRequest + fulfillCompanyBoostRequest — pin (real DB)", () => {
  test("member creates a pin request, admin fulfills it: listing pinned, ledger debited", async () => {
    const company = await createCompany();
    const admin = await createUser({ companyId: company.id, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id });
    try {
      const listing = await createSpaceListing(company.id);
      await topUp(company.id, admin.id, "50.00");

      const created = await createCompanyBoostRequest(member.id, company.id, {
        type: "pin",
        listingId: listing.id,
        durationDays: 7,
      });

      const fulfilled = await fulfillCompanyBoostRequest(admin.id, created.id);
      assert.equal(fulfilled.status, "fulfilled");

      const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      assert.ok(listingAfter.pinnedAt);
      assert.ok(listingAfter.pinnedUntil);

      // 7-day pin costs 200 credits (PIN_DURATION_COST_CREDITS) = SGD 20
      // (CREDITS_PER_SGD = 10, lib/credit-units.ts).
      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), "30"); // 50 - 20
    } finally {
      await cleanup(company.id, [admin.id, member.id]);
    }
  });

  test("createCompanyBoostRequest rejects a pin request against another company's listing", async () => {
    const company = await createCompany();
    const otherCompany = await createCompany();
    const member = await createUser({ companyId: company.id });
    try {
      const otherListing = await createSpaceListing(otherCompany.id);
      await assert.rejects(
        () => createCompanyBoostRequest(member.id, company.id, { type: "pin", listingId: otherListing.id, durationDays: 7 }),
        ListingNotFoundError
      );
    } finally {
      await cleanup(company.id, [member.id]);
      await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
    }
  });
});
