// Coverage for the new Rating feature (lib/ratings.ts) — a booking-scoped
// rating with no old-backend equivalent to mirror. Hits the real dev
// Postgres DB through Prisma (no mocking), matching lib/bookings.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ListingType, BookingType } from "../app/generated/prisma/client";
import {
  BookingNotCompletedError,
  BookingNotOwnedError,
  RatingAlreadyExistsError,
  createRating,
  getListingRatingAggregates,
  parseRatingCreateFields,
} from "./ratings";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CHECK_VIOLATION = "23514";

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Rating Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Rating Test User",
      email: `rating-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createSpaceListing(companyId: bigint) {
  return prisma.listing.create({
    data: {
      companyId,
      type: ListingType.space,
      name: "Rating Test Listing",
      priceDay: "10.00",
      priceWeek: "60.00",
      priceMonth: "200.00",
    },
  });
}

function createBooking(userId: string, listingId: bigint, status: "pending" | "completed", day = "2026-06-01") {
  return prisma.booking.create({
    data: {
      userId,
      listingId,
      bookingType: BookingType.daily,
      startDate: new Date(day),
      endDate: new Date(day),
      credits: "10.00",
      status,
    },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

describe("parseRatingCreateFields", () => {
  test("accepts an integer score 1-5 with an optional comment", () => {
    const fields = parseRatingCreateFields({ score: 4, comment: "Great space" });
    assert.equal(fields.score, 4);
    assert.equal(fields.comment, "Great space");
  });

  test("defaults comment to null when omitted", () => {
    const fields = parseRatingCreateFields({ score: 3 });
    assert.equal(fields.comment, null);
  });

  test("rejects a score outside 1-5", () => {
    assert.throws(() => parseRatingCreateFields({ score: 6 }), ApiValidationError);
    assert.throws(() => parseRatingCreateFields({ score: 0 }), ApiValidationError);
  });

  test("rejects a non-integer score", () => {
    assert.throws(() => parseRatingCreateFields({ score: 3.5 }), ApiValidationError);
  });
});

describe("createRating", () => {
  test("succeeds for a completed booking owned by the caller", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBooking(user.id, listing.id, "completed");

      const rating = await createRating(booking.id, user.id, { score: 5, comment: "Loved it" });
      assert.equal(rating.score, 5);
      assert.equal(rating.comment, "Loved it");
      assert.equal(rating.listingId, listing.id, "listingId must be copied off the booking");
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects a booking that belongs to a different user", async () => {
    const company = await createCompany();
    const owner = await createUser();
    const otherUser = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBooking(owner.id, listing.id, "completed");

      await assert.rejects(
        () => createRating(booking.id, otherUser.id, { score: 5, comment: null }),
        BookingNotOwnedError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [owner.id, otherUser.id]);
    }
  });

  test("rejects a booking that isn't completed yet", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBooking(user.id, listing.id, "pending");

      await assert.rejects(
        () => createRating(booking.id, user.id, { score: 5, comment: null }),
        BookingNotCompletedError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects a second rating for the same booking", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBooking(user.id, listing.id, "completed");

      await createRating(booking.id, user.id, { score: 4, comment: null });

      await assert.rejects(
        () => createRating(booking.id, user.id, { score: 2, comment: "changed my mind" }),
        RatingAlreadyExistsError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("the ratings_score_range CHECK constraint rejects an out-of-range score at the DB level", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const booking = await createBooking(user.id, listing.id, "completed");

      await assert.rejects(
        () =>
          prisma.rating.create({
            data: { bookingId: booking.id, userId: user.id, listingId: listing.id, score: 7 },
          }),
        (err: unknown) => {
          const code = (err as { cause?: { code?: string } })?.cause?.code;
          assert.equal(code, CHECK_VIOLATION, `expected Postgres code ${CHECK_VIOLATION}, got ${code}`);
          return true;
        }
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("getListingRatingAggregates", () => {
  test("computes average and count across multiple ratings for the same listing", async () => {
    const company = await createCompany();
    const userA = await createUser();
    const userB = await createUser();
    try {
      const listing = await createSpaceListing(company.id);
      const bookingA = await createBooking(userA.id, listing.id, "completed", "2026-07-01");
      const bookingB = await createBooking(userB.id, listing.id, "completed", "2026-07-10");

      await createRating(bookingA.id, userA.id, { score: 4, comment: null });
      await createRating(bookingB.id, userB.id, { score: 2, comment: null });

      const aggregates = await getListingRatingAggregates([listing.id]);
      const aggregate = aggregates.get(listing.id.toString());
      assert.ok(aggregate);
      assert.equal(aggregate!.ratingCount, 2);
      assert.equal(aggregate!.averageRating, 3);
    } finally {
      await cleanupCompanyAndUsers(company.id, [userA.id, userB.id]);
    }
  });

  test("returns an empty map for an empty id list", async () => {
    const aggregates = await getListingRatingAggregates([]);
    assert.equal(aggregates.size, 0);
  });
});
