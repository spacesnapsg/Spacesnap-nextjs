// Coverage for the per-supplier "owner" field (company-admin "by individual
// supplier" earnings toggle) — pure parse/serialize behavior only. The
// admin-only reassignment gate itself lives in the PATCH route
// (app/api/supplier/listings/[id]/route.ts), not a lib function, and this
// codebase doesn't unit-test route handlers directly (auth/session are only
// ever verified live, same as every other requireCompanyAdmin()-gated
// route) — so that gate isn't covered here.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { Listing } from "../app/generated/prisma/client";
import { parseListingFields, serializeListing } from "./listings";

describe("parseListingFields — ownerId", () => {
  test("accepts a string ownerId", () => {
    const fields = parseListingFields({ ownerId: "abc123" }, { partial: true });
    assert.equal(fields.ownerId, "abc123");
  });

  test("accepts an explicit null (unassign)", () => {
    const fields = parseListingFields({ ownerId: null }, { partial: true });
    assert.equal(fields.ownerId, null);
  });

  test("omitted entirely leaves it undefined (no change)", () => {
    const fields = parseListingFields({}, { partial: true });
    assert.equal(fields.ownerId, undefined);
  });

  test("rejects a non-string, non-null value", () => {
    assert.throws(() => parseListingFields({ ownerId: 42 }, { partial: true }));
  });
});

describe("serializeListing — ownerId/ownerName", () => {
  const baseListing = {
    id: BigInt(1),
    companyId: BigInt(1),
    ownerId: "user_1",
    type: "space",
    name: "Test Listing",
    location: null,
    description: null,
    imageUrl: null,
    amenities: null,
    isAvailable: true,
    requireApproval: false,
    priceDay: null,
    priceWeek: null,
    priceMonth: null,
    pricePerUnit: null,
    stockQuantity: null,
    packSize: null,
    boostedAt: new Date("2026-01-01"),
    pinnedAt: null,
    pinnedUntil: null,
    acceptsInternalSignoff: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  } as unknown as Listing;

  test("ownerId is always present as a scalar, regardless of include", () => {
    const result = serializeListing(baseListing);
    assert.equal(result.ownerId, "user_1");
  });

  test("ownerId null serializes as null (Unassigned)", () => {
    const result = serializeListing({ ...baseListing, ownerId: null });
    assert.equal(result.ownerId, null);
  });

  test("ownerName is included when the owner relation was loaded", () => {
    const withOwner = { ...baseListing, owner: { name: "Ada Lovelace" } };
    const result = serializeListing(withOwner);
    assert.equal(result.ownerName, "Ada Lovelace");
  });

  test("ownerName is undefined (not null) when the owner relation wasn't loaded", () => {
    const result = serializeListing(baseListing);
    assert.equal(result.ownerName, undefined);
  });

  test("ownerName is null when the relation was loaded but there's no owner", () => {
    const withOwner = { ...baseListing, ownerId: null, owner: null };
    const result = serializeListing(withOwner);
    assert.equal(result.ownerName, null);
  });
});
