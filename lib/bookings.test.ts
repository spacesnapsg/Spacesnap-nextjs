// Coverage for the app-layer overlap pre-check (Sprint 4, Item 3), the
// counterpart to the DB-level bookings_no_overlap exclusion constraint
// covered in prisma/tests/db-constraints.test.ts. Hits the real dev Postgres
// DB through Prisma (no mocking) since this function's whole job is to mirror
// that constraint's date-range/status semantics ahead of the insert.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType, TransactionType } from "../app/generated/prisma/client";
import {
  hasOverlappingBooking,
  createBookingWithDebit,
  getCreditBalance,
  InsufficientCreditBalanceError,
  confirmBookingWithAudit,
  BookingNotConfirmableError,
} from "./bookings";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Overlap Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Overlap Test User",
      email: `overlap-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Overlap Test Listing",
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

describe("hasOverlappingBooking (app-layer mirror of bookings_no_overlap)", () => {
  test("detects an overlap against an existing active booking on the same listing", async () => {
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
          credits: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-03-03", "2027-03-07");
      assert.equal(result, true);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("inclusive date bounds: a booking sharing only the boundary day still overlaps", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-04-01"),
          endDate: new Date("2027-04-05"),
          credits: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-04-05", "2027-04-10");
      assert.equal(result, true);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("returns false for genuinely non-overlapping dates on the same listing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-05-01"),
          endDate: new Date("2027-05-05"),
          credits: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-05-06", "2027-05-10");
      assert.equal(result, false);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("a cancelled booking does not block the slot", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-06-01"),
          endDate: new Date("2027-06-05"),
          credits: "10.00",
          status: "cancelled",
        },
      });

      const result = await hasOverlappingBooking(listing.id, "2027-06-02", "2027-06-04");
      assert.equal(result, false);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("overlap on one listing does not block a different listing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listingA = await createSpaceListing(company.id);
      const listingB = await createSpaceListing(company.id);
      await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listingA.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-07-01"),
          endDate: new Date("2027-07-05"),
          credits: "10.00",
        },
      });

      const result = await hasOverlappingBooking(listingB.id, "2027-07-02", "2027-07-04");
      assert.equal(result, false);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// Coverage for the Sprint 3.5 ledger gap: balance check, Booking insert, and
// debit Transaction row all inside one DB transaction (createBookingWithDebit).
// Balance is never a stored column — always SUM(Transaction.amount) for the
// user, per the Transaction model's comment in schema.prisma — so these tests
// assert against the ledger, not a credit_balance field that doesn't exist.
describe("createBookingWithDebit (Sprint 3.5, ledger-atomic booking creation)", () => {
  test("rejects with InsufficientCreditBalanceError when the user has no credits, and writes nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);

      await assert.rejects(
        () =>
          createBookingWithDebit({
            userId: user.id,
            listingId: listing.id,
            bookingType: BookingType.daily,
            startDate: "2027-09-01",
            endDate: "2027-09-01",
            cost: listing.priceDay!,
          }),
        InsufficientCreditBalanceError
      );

      const bookings = await prisma.booking.findMany({ where: { userId: user.id } });
      assert.equal(bookings.length, 0);
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
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "9.99" },
      });

      await assert.rejects(
        () =>
          createBookingWithDebit({
            userId: user.id,
            listingId: listing.id,
            bookingType: BookingType.daily,
            startDate: "2027-09-02",
            endDate: "2027-09-02",
            cost: listing.priceDay!,
          }),
        InsufficientCreditBalanceError
      );

      const bookings = await prisma.booking.findMany({ where: { userId: user.id } });
      assert.equal(bookings.length, 0);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("succeeds when balance exactly matches cost: balance decremented to zero, one debit Transaction row", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "10.00" },
      });

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-09-03",
        endDate: "2027-09-03",
        cost: listing.priceDay!,
      });

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "0");

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.booking);
      assert.equal(transactions[0].amount.toString(), "-10");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("succeeds with balance to spare: balance decremented by exactly the cost, exactly one Transaction row created", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id); // priceDay 10.00
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.topup, amount: "50.00" },
      });
      const balanceBefore = await getCreditBalance(user.id);
      assert.equal(balanceBefore.toString(), "50");

      const booking = await createBookingWithDebit({
        userId: user.id,
        listingId: listing.id,
        bookingType: BookingType.daily,
        startDate: "2027-09-04",
        endDate: "2027-09-04",
        cost: listing.priceDay!,
      });

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "40");

      const bookingRow = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.ok(bookingRow);
      assert.equal(bookingRow!.credits.toString(), "10");

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 2); // the topup + the debit
      const debit = transactions.find((t) => t.type === TransactionType.booking);
      assert.ok(debit);
      assert.equal(debit!.bookingId?.toString(), booking.id.toString());
      assert.equal(debit!.amount.toString(), "-10");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// Coverage for the Sprint 3.5 ledger gap #2: confirm's own audit-trail row.
// Credits are already fully debited at booking creation (createBookingWithDebit
// above, in both this design and the old Laravel build) — so confirm writes a
// zero-amount Transaction rather than a second debit, and must never write a
// second row when called against a booking that isn't `pending`.
describe("confirmBookingWithAudit (Sprint 3.5, known gap #2)", () => {
  test("confirms a pending booking and writes exactly one zero-amount audit Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-10-01"),
          endDate: new Date("2027-10-01"),
          credits: "10.00",
        },
      });

      const updated = await confirmBookingWithAudit(booking.id);
      assert.equal(updated.status, "confirmed");

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.booking);
      assert.equal(transactions[0].amount.toString(), "0");
      assert.equal(transactions[0].userId, user.id);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("confirming an already-confirmed booking rejects cleanly, no duplicate Transaction written", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-10-02"),
          endDate: new Date("2027-10-02"),
          credits: "10.00",
        },
      });

      await confirmBookingWithAudit(booking.id);

      await assert.rejects(() => confirmBookingWithAudit(booking.id), BookingNotConfirmableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("confirming a cancelled booking rejects cleanly and writes no orphan Transaction", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          listingId: listing.id,
          bookingType: BookingType.daily,
          startDate: new Date("2027-10-03"),
          endDate: new Date("2027-10-03"),
          credits: "10.00",
          status: "cancelled",
        },
      });

      await assert.rejects(() => confirmBookingWithAudit(booking.id), BookingNotConfirmableError);

      const transactions = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
      assert.equal(transactions.length, 0);

      const bookingRow = await prisma.booking.findUnique({ where: { id: booking.id } });
      assert.equal(bookingRow!.status, "cancelled");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
