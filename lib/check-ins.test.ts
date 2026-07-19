// Coverage for the Sprint 3.5 new schema item: check_ins table + the
// confirmed product decision that check-in flips a `confirmed` booking to
// `active`, and check-out flips `active` to `completed`. Hits the real test
// DB through Prisma (no mocking), same convention as lib/bookings.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType } from "../app/generated/prisma/client";
import {
  createCheckIn,
  checkOutCheckIn,
  BookingNotCheckInableError,
  BookingNotCheckOutableError,
  CheckInAlreadyCheckedOutError,
} from "./check-ins";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Check-In Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Check-In Test User",
      email: `check-in-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Check-In Test Listing",
      priceDay: "10.00",
      priceWeek: "60.00",
      priceMonth: "200.00",
    },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

describe("createCheckIn (Sprint 3.5, check_ins new schema item)", () => {
  test("a bare check-in (no bookingId) creates a row and never touches any booking", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);

      const checkIn = await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: null });

      assert.equal(checkIn.userId, user.id);
      assert.equal(checkIn.listingId, listing.id);
      assert.equal(checkIn.bookingId, null);
      assert.equal(checkIn.checkedOutAt, null);
      assert.ok(checkIn.checkedInAt);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("checking in against a confirmed booking flips it to active", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-12-01"),
          endDate: new Date("2027-12-01"),
          credits: "10.00",
          status: "confirmed",
        },
      });

      const checkIn = await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: booking.id });
      assert.equal(checkIn.bookingId?.toString(), booking.id.toString());

      const bookingRow = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(bookingRow!.status, "active");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("checking in against a pending (unconfirmed) booking rejects cleanly and writes no check-in row", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-12-02"),
          endDate: new Date("2027-12-02"),
          credits: "10.00",
        },
      });

      await assert.rejects(
        () => createCheckIn({ userId: user.id, listingId: listing.id, bookingId: booking.id }),
        BookingNotCheckInableError
      );

      const checkIns = await prisma.checkIn.findMany({ where: { bookingId: booking.id } });
      assert.equal(checkIns.length, 0);

      const bookingRow = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(bookingRow!.status, "pending");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("checking in against an already-active booking rejects cleanly (no re-check-in)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-12-03"),
          endDate: new Date("2027-12-03"),
          credits: "10.00",
          status: "confirmed",
        },
      });

      await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: booking.id });

      await assert.rejects(
        () => createCheckIn({ userId: user.id, listingId: listing.id, bookingId: booking.id }),
        BookingNotCheckInableError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("checkOutCheckIn (Sprint 3.5, check_ins new schema item)", () => {
  test("checking out a bare check-in (no bookingId) just sets checkedOutAt", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const checkIn = await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: null });

      const updated = await checkOutCheckIn(checkIn.id);
      assert.ok(updated.checkedOutAt);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("checking out a booking-linked check-in flips the booking from active to completed", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-12-04"),
          endDate: new Date("2027-12-04"),
          credits: "10.00",
          status: "confirmed",
        },
      });
      const checkIn = await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: booking.id });

      const updated = await checkOutCheckIn(checkIn.id);
      assert.ok(updated.checkedOutAt);

      const bookingRow = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(bookingRow!.status, "completed");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("checking out an already-checked-out check-in rejects cleanly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const checkIn = await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: null });
      await checkOutCheckIn(checkIn.id);

      await assert.rejects(() => checkOutCheckIn(checkIn.id), CheckInAlreadyCheckedOutError);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("checking out when the linked booking is no longer active rejects cleanly", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-12-05"),
          endDate: new Date("2027-12-05"),
          credits: "10.00",
          status: "confirmed",
        },
      });
      const checkIn = await createCheckIn({ userId: user.id, listingId: listing.id, bookingId: booking.id });

      // Simulate an out-of-band status change (e.g. supplier cancels mid-stay)
      // so the booking is no longer `active` by the time check-out runs.
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled" } });

      await assert.rejects(() => checkOutCheckIn(checkIn.id), BookingNotCheckOutableError);

      const checkInRow = await prisma.checkIn.findUnique({ where: { id: checkIn.id } });
      assert.equal(checkInRow!.checkedOutAt, null);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
