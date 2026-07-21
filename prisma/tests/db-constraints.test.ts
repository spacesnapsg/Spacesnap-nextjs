// Automated coverage for the DB-level constraints added in migrations
// 20260718171742_bookings_no_overlap_exclude, 20260718171756_listings_pricing_check,
// and 20260718192008_users_company_admin_requires_supplier.
// Replaces the manual raw-SQL verification from that session — run via
// `npm test`. Hits the real dev Postgres DB through Prisma (no mocking),
// since these are constraints enforced by Postgres itself, not app logic.
import "dotenv/config";
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  ListingType,
  BookingType,
  BookingStatus,
} from "../../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Postgres SQLSTATE codes: exclusion_violation, check_violation.
const EXCLUSION_VIOLATION = "23P01";
const CHECK_VIOLATION = "23514";

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Constraint Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Constraint Test User",
      email: `constraint-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint, overrides: Record<string, unknown> = {}) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Constraint Test Listing",
      priceDay: "10.00",
      priceWeek: "60.00",
      priceMonth: "200.00",
      ...overrides,
    },
  });
}

// Deleting the company cascades to its listings, which cascades to any
// bookings on those listings (all FKs are ON DELETE CASCADE) — so this is
// enough to remove everything a test created.
async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

async function assertPgError(fn: () => Promise<unknown>, expectedCode: string) {
  await assert.rejects(fn, (err: any) => {
    assert.equal(err?.cause?.code, expectedCode, `expected Postgres code ${expectedCode}, got ${err?.cause?.code}: ${err?.message}`);
    return true;
  });
}

describe("bookings_no_overlap exclusion constraint", () => {
  test("overlapping booking on the same listing is rejected (23P01)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);

      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-01-01"),
          endDate: new Date("2027-01-05"),
          sgdAmount: "10.00",
        },
      });

      await assertPgError(
        () =>
          prisma.booking.create({
            data: {
              userId: user.id,
              listingId: listing.id,
              bookingType: BookingType.daily,
              startDate: new Date("2027-01-03"),
              endDate: new Date("2027-01-07"),
              sgdAmount: "10.00",
            },
          }),
        EXCLUSION_VIOLATION,
      );

      const bookings = await prisma.booking.findMany({ where: { listingId: listing.id } });
      assert.equal(bookings.length, 1, "rejected booking must not have been persisted");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("non-overlapping booking on the same listing succeeds", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);

      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-02-01"),
          endDate: new Date("2027-02-05"),
          sgdAmount: "10.00",
        },
      });

      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-02-06"),
          endDate: new Date("2027-02-10"),
          sgdAmount: "10.00",
        },
      });

      const bookings = await prisma.booking.findMany({ where: { listingId: listing.id } });
      assert.equal(bookings.length, 2);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("overlapping booking succeeds when the existing booking is cancelled", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);

      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-03-01"),
          endDate: new Date("2027-03-05"),
          sgdAmount: "10.00",
          status: BookingStatus.cancelled,
        },
      });

      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-03-02"),
          endDate: new Date("2027-03-06"),
          sgdAmount: "10.00",
        },
      });

      const bookings = await prisma.booking.findMany({ where: { listingId: listing.id } });
      assert.equal(bookings.length, 2);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("overlapping bookings on different listings both succeed (scoped per-listing)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listingA = await createSpaceListing(company.id, { name: "Constraint Test Listing A" });
      const listingB = await createSpaceListing(company.id, { name: "Constraint Test Listing B" });

      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listingA.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-04-01"),
          endDate: new Date("2027-04-05"),
          sgdAmount: "10.00",
        },
      });

      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listingB.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-04-01"),
          endDate: new Date("2027-04-05"),
          sgdAmount: "10.00",
        },
      });

      const bookingsA = await prisma.booking.findMany({ where: { listingId: listingA.id } });
      const bookingsB = await prisma.booking.findMany({ where: { listingId: listingB.id } });
      assert.equal(bookingsA.length, 1);
      assert.equal(bookingsB.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("listings_pricing_matches_type CHECK constraint", () => {
  test("space/equipment listing with day/week/month set and per-unit fields null succeeds", async () => {
    const company = await createCompany();
    try {
      const listing = await createSpaceListing(company.id, {
        type: ListingType.equipment,
        priceDay: "15.00",
        priceWeek: "80.00",
        priceMonth: "300.00",
      });
      assert.ok(listing.id);
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });

  test("space/equipment listing missing one or more of day/week/month is rejected", async () => {
    const company = await createCompany();
    try {
      await assertPgError(
        () =>
          createSpaceListing(company.id, {
            type: ListingType.space,
            priceDay: "15.00",
            priceWeek: null,
            priceMonth: null,
          }),
        CHECK_VIOLATION,
      );

      const listings = await prisma.listing.findMany({ where: { companyId: company.id } });
      assert.equal(listings.length, 0, "rejected listing must not have been persisted");
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });

  test("consumables listing with per-unit fields set and day/week/month null succeeds", async () => {
    const company = await createCompany();
    try {
      const listing = await createSpaceListing(company.id, {
        type: ListingType.consumables,
        priceDay: null,
        priceWeek: null,
        priceMonth: null,
        pricePerUnit: "2.50",
        stockQuantity: 500,
        packSize: "Pack of 10",
      });
      assert.ok(listing.id);
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });

  test("consumables listing with day/week/month set instead of per-unit fields is rejected", async () => {
    const company = await createCompany();
    try {
      await assertPgError(
        () =>
          createSpaceListing(company.id, {
            type: ListingType.consumables,
            priceDay: "10.00",
            priceWeek: "60.00",
            priceMonth: "200.00",
          }),
        CHECK_VIOLATION,
      );

      const listings = await prisma.listing.findMany({ where: { companyId: company.id } });
      assert.equal(listings.length, 0, "rejected listing must not have been persisted");
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });

  test("listing with both pricing shapes fully set is rejected", async () => {
    const company = await createCompany();
    try {
      await assertPgError(
        () =>
          createSpaceListing(company.id, {
            type: ListingType.space,
            priceDay: "10.00",
            priceWeek: "60.00",
            priceMonth: "200.00",
            pricePerUnit: "2.50",
            stockQuantity: 500,
            packSize: "Pack of 10",
          }),
        CHECK_VIOLATION,
      );

      const listings = await prisma.listing.findMany({ where: { companyId: company.id } });
      assert.equal(listings.length, 0, "rejected listing must not have been persisted");
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });
});

describe("users_company_admin_requires_supplier CHECK constraint", () => {
  test("company admin without supplier flag is rejected", async () => {
    userCounter += 1;
    const email = `constraint-test-${Date.now()}-${userCounter}@example.com`;

    await assertPgError(
      () =>
        prisma.user.create({
          data: {
            name: "Constraint Test User",
            email,
            password: "x",
            isCompanyAdmin: true,
            isSupplier: false,
          },
        }),
      CHECK_VIOLATION,
    );

    const users = await prisma.user.findMany({ where: { email } });
    assert.equal(users.length, 0, "rejected user must not have been persisted");
  });

  test("company admin with supplier flag succeeds", async () => {
    const user = await createUser();
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { isSupplier: true, isCompanyAdmin: true },
      });
      assert.equal(updated.isCompanyAdmin, true);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

after(async () => {
  await prisma.$disconnect();
});
