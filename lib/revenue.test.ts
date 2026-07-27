// Coverage for the revenue-reporting aggregation (financial audit F1,
// 2026-07-24). The split-ledger rewrite moved every real charge onto new
// TransactionType values (booking_payment / booking_modification_fee /
// purchased_spend), but lib/revenue.ts's REVENUE_TRANSACTION_TYPES was never
// updated — so completed bookings reported 0 revenue and refunds pushed it
// negative. These tests pin the corrected behavior: the split-ledger types
// count, legacy/seed `booking`/`purchase`/`refund` rows still count, refunds
// net out, and earned-credit rows never leak into revenue.
//
// Hits the real dev Postgres DB through Prisma (no mocking), same convention
// as lib/supplier-payables.test.ts. Transaction rows are inserted directly
// (not through createBookingWithDebit) so the aggregation is tested in
// isolation from the Stripe charge machinery — the reporting layer was the
// gap, not the charge path.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  ListingType,
  BookingType,
  TransactionType,
  PayoutCadence,
  type Company,
  type Listing,
  type User,
} from "../app/generated/prisma/client";
import { getRevenueByCompany, getCompanyNetPayoutByTypeAndMonth, getRevenueTransactionFeed } from "./revenue";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let counter = 0;
function uniq() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

async function createFixture() {
  const company = await prisma.company.create({ data: { name: `Revenue Test Co ${uniq()}` } });
  const user = await prisma.user.create({
    data: { name: "Revenue Test User", email: `revenue-test-${uniq()}@example.com`, password: "x" },
  });
  const spaceListing = await prisma.listing.create({
    data: {
      companyId: company.id,
      type: ListingType.space,
      name: "Rev Space",
      priceDay: "10.00",
      priceWeek: "60.00",
      priceMonth: "200.00",
    },
  });
  const consumableListing = await prisma.listing.create({
    data: {
      companyId: company.id,
      type: ListingType.consumables,
      name: "Rev Consumable",
      pricePerUnit: "5.00",
      stockQuantity: 100,
      packSize: "10",
    },
  });
  return { company, user, spaceListing, consumableListing };
}

async function cleanup(company: Company, user: User) {
  // Deleting the company cascades listings/bookings/purchases; deleting the
  // user cascades their transactions (Transaction.user is onDelete: Cascade).
  await prisma.company.delete({ where: { id: company.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

// Inserts a Booking + a Transaction of the given type attributed to it.
let bookingDayOffset = 0;
async function bookingTransaction(
  user: User,
  listing: Listing,
  type: TransactionType,
  amountSgd: string
) {
  // Distinct date per booking so multiple bookings on one listing don't trip
  // the bookings_no_overlap exclusion constraint. The date is irrelevant to
  // revenue attribution (which keys off the Transaction, not the stay dates).
  bookingDayOffset += 1;
  const day = new Date(Date.UTC(2026, 0, 1) + bookingDayOffset * 24 * 60 * 60 * 1000);
  const booking = await prisma.booking.create({
    data: {
      userId: user.id,
      listingId: listing.id,
      bookingType: BookingType.daily,
      startDate: day,
      endDate: day,
      sgdAmount: amountSgd.replace("-", ""),
    },
  });
  await prisma.transaction.create({
    data: { userId: user.id, bookingId: booking.id, type, amount: amountSgd },
  });
  return booking;
}

async function purchaseTransaction(user: User, listing: Listing, type: TransactionType, amountSgd: string) {
  const purchase = await prisma.purchase.create({
    data: { userId: user.id, listingId: listing.id, quantity: 1, credits: amountSgd.replace("-", "") },
  });
  await prisma.transaction.create({
    data: { userId: user.id, purchaseId: purchase.id, type, amount: amountSgd },
  });
  return purchase;
}

async function revenueForCompany(companyId: bigint): Promise<string> {
  const rows = await getRevenueByCompany();
  const row = rows.find((r) => r.companyId === companyId.toString());
  assert.ok(row, "company should appear in getRevenueByCompany output");
  return row.revenue;
}

describe("getRevenueByCompany — split-ledger F1 fix", () => {
  // The core regression: a real live booking charge (booking_payment) must
  // count as revenue. Before the F1 fix this returned "0.00".
  test("a live booking_payment charge counts as revenue", async () => {
    const { company, user, spaceListing } = await createFixture();
    try {
      await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-100.00");
      // 100 SGD collected → 1000 credits (CREDITS_PER_SGD = 10).
      assert.equal(await revenueForCompany(company.id), "1000.00");
    } finally {
      await cleanup(company, user);
    }
  });

  // A Buy Now consumables sale (purchased_spend) must count too — this was
  // also silently missing, so the consumables revenue column read 0.
  test("a Buy Now purchased_spend sale counts as revenue", async () => {
    const { company, user, consumableListing } = await createFixture();
    try {
      await purchaseTransaction(user, consumableListing, TransactionType.purchased_spend, "-50.00");
      assert.equal(await revenueForCompany(company.id), "500.00");
    } finally {
      await cleanup(company, user);
    }
  });

  // A charge followed by a full refund nets to 0 (not negative) — the exact
  // invariant that broke when the debit type changed from `booking` to
  // `booking_payment` while `refund` stayed counted.
  test("a booking_payment fully refunded nets to zero, not negative", async () => {
    const { company, user, spaceListing } = await createFixture();
    try {
      const booking = await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-40.00");
      await prisma.transaction.create({
        data: { userId: user.id, bookingId: booking.id, type: TransactionType.refund, amount: "40.00" },
      });
      assert.equal(await revenueForCompany(company.id), "0.00");
    } finally {
      await cleanup(company, user);
    }
  });

  // Legacy/seed rows (prisma/seed.ts still writes `booking` with real amounts)
  // must keep counting — the fix ADDS the new types, it doesn't replace the
  // old ones.
  test("legacy `booking` and modification-fee rows still count", async () => {
    const { company, user, spaceListing } = await createFixture();
    try {
      await bookingTransaction(user, spaceListing, TransactionType.booking, "-70.00");
      await bookingTransaction(user, spaceListing, TransactionType.booking_modification_fee, "-10.00");
      // 70 + 10 = 80 SGD → 800 credits.
      assert.equal(await revenueForCompany(company.id), "800.00");
    } finally {
      await cleanup(company, user);
    }
  });

  // Earned-credit discount rows are promotional issuance, not money received —
  // they must never inflate revenue.
  test("earned_spend / earned_grant rows are excluded from revenue", async () => {
    const { company, user, spaceListing } = await createFixture();
    try {
      const booking = await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-90.00");
      await prisma.transaction.create({
        data: { userId: user.id, bookingId: booking.id, type: TransactionType.earned_spend, amount: "-10.00" },
      });
      // Only the 90 SGD actually collected counts → 900 credits, not 1000.
      assert.equal(await revenueForCompany(company.id), "900.00");
    } finally {
      await cleanup(company, user);
    }
  });
});

// 2026-07-27 — admin UI request: the cross-company feed needed search +
// pagination before the transaction count "gets crazy" as it grows.
describe("getRevenueTransactionFeed — search + pagination", () => {
  test("search filters to the searched company's own transactions only, with an accurate total", async () => {
    const { company, user, spaceListing } = await createFixture();
    const other = await createFixture();
    try {
      await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-10.00");
      await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-20.00");
      await bookingTransaction(other.user, other.spaceListing, TransactionType.booking_payment, "-30.00");

      const result = await getRevenueTransactionFeed({ search: company.name });
      assert.equal(result.meta.total, 2);
      assert.equal(result.transactions.length, 2);
      assert.ok(result.transactions.every((t) => t.companyId === company.id.toString()));
    } finally {
      await cleanup(company, user);
      await cleanup(other.company, other.user);
    }
  });

  test("a page past the last result is empty but reports the real total", async () => {
    const { company, user, spaceListing } = await createFixture();
    try {
      await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-10.00");

      const result = await getRevenueTransactionFeed({ search: company.name, page: 2 });
      assert.equal(result.transactions.length, 0);
      assert.equal(result.meta.total, 1);
      assert.equal(result.meta.page, 2);
    } finally {
      await cleanup(company, user);
    }
  });

  test("zero-amount audit rows stay excluded from both the list and the total, same as the unfiltered feed", async () => {
    const { company, user, spaceListing } = await createFixture();
    try {
      const booking = await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-10.00");
      await prisma.transaction.create({
        data: { userId: user.id, bookingId: booking.id, type: TransactionType.booking, amount: "0" },
      });

      const result = await getRevenueTransactionFeed({ search: company.name });
      assert.equal(result.meta.total, 1);
      assert.equal(result.transactions[0].type, TransactionType.booking_payment);
    } finally {
      await cleanup(company, user);
    }
  });
});

describe("getCompanyNetPayoutByTypeAndMonth — net payout by type (F5)", () => {
  // The supplier's chart shows their NET PAYOUT (SupplierPayable.netAmount),
  // not the marked-up member price: a booking payable of 90 → space 900
  // credits, a consumable payable of 46.50 → consumable 465 credits.
  test("buckets a booking payable as space and a consumable payable as consumable", async () => {
    const { company, user, spaceListing, consumableListing } = await createFixture();
    try {
      const booking = await bookingTransaction(user, spaceListing, TransactionType.booking_payment, "-100.00");
      await prisma.supplierPayable.create({
        data: {
          companyId: company.id,
          bookingId: booking.id,
          grossAmount: "90.00",
          commissionAmount: "10.00",
          netAmount: "90.00",
          payoutCadence: PayoutCadence.biweekly,
        },
      });
      const purchase = await purchaseTransaction(user, consumableListing, TransactionType.purchased_spend, "-50.00");
      await prisma.supplierPayable.create({
        data: {
          companyId: company.id,
          purchaseId: purchase.id,
          grossAmount: "46.50",
          commissionAmount: "3.50",
          netAmount: "46.50",
          payoutCadence: PayoutCadence.biweekly,
        },
      });

      const rows = await getCompanyNetPayoutByTypeAndMonth(company.id, { months: 1 });
      const current = rows[rows.length - 1];
      assert.equal(current.space || 0, 900);
      assert.equal(current.consumable || 0, 465);
      assert.equal(current.equipment || 0, 0);
    } finally {
      await cleanup(company, user);
    }
  });
});
