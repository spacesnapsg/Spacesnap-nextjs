// Coverage for lib/boost-products.ts — the "Boost Your Listings" catalogue's
// parse/serialize/purchase layer (see BoostProduct's own schema comment).
// Real dev/test Postgres DB via Prisma, same convention as
// lib/company-boost-requests.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../app/generated/prisma/client";
import {
  parseBoostProductCreateFields,
  parseBoostProductUpdateFields,
  assertDeletable,
  computeNextSortOrder,
  purchaseBoostProduct,
  BuiltinBoostProductNotDeletableError,
  BoostProductNotPurchasableHereError,
  BoostProductInactiveError,
} from "./boost-products";
import { InsufficientCompanyPurchasedBalanceError, createCompanyTopUp, getCompanyPurchasedBalance } from "./company-credits";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({ data: { name: `Boost Product Test Co ${Date.now()}-${companyCounter}` } });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Boost Product Test User",
      email: `boost-product-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
      isSupplier: true,
    },
  });
}

let productCounter = 0;
function createCustomProduct(overrides: Partial<{ active: boolean; priceCredits: number }> = {}) {
  productCounter += 1;
  return prisma.boostProduct.create({
    data: {
      builtinEffect: "none",
      name: `Test Product ${Date.now()}-${productCounter}`,
      description: "A test product.",
      iconName: "star",
      active: overrides.active ?? true,
      priceCredits: overrides.priceCredits ?? 10,
    },
  });
}

async function topUp(companyId: bigint, userId: string, amountSgd: string) {
  await createCompanyTopUp(companyId, userId, new Prisma.Decimal(amountSgd));
}

async function cleanup(companyId: bigint | null, userIds: string[], productIds: bigint[] = []) {
  if (companyId) await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  for (const id of productIds) {
    await prisma.boostProduct.delete({ where: { id } }).catch(() => {});
  }
}

describe("parseBoostProductCreateFields", () => {
  test("accepts a valid body, defaulting active to true and iconName to star", () => {
    const fields = parseBoostProductCreateFields({ name: "Lab Digest", description: "A report.", priceCredits: 100 });
    assert.equal(fields.name, "Lab Digest");
    assert.equal(fields.iconName, "star");
    assert.equal(fields.active, true);
  });

  test("rejects a body carrying builtinEffect — new products are always custom", () => {
    assert.throws(() => parseBoostProductCreateFields({ builtinEffect: "bump", name: "x", description: "x", priceCredits: 1 }), ApiValidationError);
  });

  test("rejects a missing name/description/priceCredits", () => {
    assert.throws(() => parseBoostProductCreateFields({ description: "x", priceCredits: 1 }), ApiValidationError);
    assert.throws(() => parseBoostProductCreateFields({ name: "x", priceCredits: 1 }), ApiValidationError);
    assert.throws(() => parseBoostProductCreateFields({ name: "x", description: "x" }), ApiValidationError);
  });

  test("rejects an invalid iconName", () => {
    assert.throws(
      () => parseBoostProductCreateFields({ name: "x", description: "x", priceCredits: 1, iconName: "rocket" }),
      ApiValidationError
    );
  });
});

describe("parseBoostProductUpdateFields", () => {
  test("bump/none rows: priceCredits is accepted, pin7/pin30 are rejected", () => {
    const fields = parseBoostProductUpdateFields("none", { priceCredits: 50 });
    assert.equal(fields.priceCredits, 50);
    assert.throws(() => parseBoostProductUpdateFields("none", { pin7PriceCredits: 200 }), ApiValidationError);
  });

  test("pin rows: pin7/pin30PriceCredits are accepted, priceCredits is rejected", () => {
    const fields = parseBoostProductUpdateFields("pin", { pin7PriceCredits: 200, pin30PriceCredits: 600 });
    assert.equal(fields.pin7PriceCredits, 200);
    assert.equal(fields.pin30PriceCredits, 600);
    assert.throws(() => parseBoostProductUpdateFields("pin", { priceCredits: 50 }), ApiValidationError);
  });

  test("name/description/iconName/active are always accepted, partial updates leave other fields untouched", () => {
    const fields = parseBoostProductUpdateFields("bump", { active: false });
    assert.deepEqual(fields, { active: false });
  });
});

describe("assertDeletable", () => {
  test("throws for bump/pin, passes for none", () => {
    assert.throws(() => assertDeletable({ builtinEffect: "bump" }), BuiltinBoostProductNotDeletableError);
    assert.throws(() => assertDeletable({ builtinEffect: "pin" }), BuiltinBoostProductNotDeletableError);
    assert.doesNotThrow(() => assertDeletable({ builtinEffect: "none" }));
  });
});

describe("computeNextSortOrder", () => {
  test("returns one past the current highest sortOrder", async () => {
    const bump = await prisma.boostProduct.findFirstOrThrow({ where: { builtinEffect: "bump" } });
    const next = await computeNextSortOrder();
    assert.ok(next > bump.sortOrder);
  });
});

describe("purchaseBoostProduct (real DB)", () => {
  test("debits purchasedBalance by quantity * priceCredits and writes a purchased_spend row — no admin approval step", async () => {
    const company = await createCompany();
    const user = await createUser();
    const product = await createCustomProduct({ priceCredits: 100 });
    try {
      await topUp(company.id, user.id, "1000"); // S$1000 = 10,000 credits

      const { quantity } = await purchaseBoostProduct(company.id, product.id, 3, user.id);
      assert.equal(quantity, 3);

      // 300 credits = S$30, so balance drops from 1000 to 970.
      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), "970");

      const rows = await prisma.companyTransaction.findMany({ where: { companyId: company.id, type: "purchased_spend" } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].userId, user.id);
      assert.match(rows[0].description ?? "", /3x/);
    } finally {
      await cleanup(company.id, [user.id], [product.id]);
    }
  });

  test("insufficient balance is rejected with no partial debit", async () => {
    const company = await createCompany();
    const user = await createUser();
    const product = await createCustomProduct({ priceCredits: 100 });
    try {
      await assert.rejects(() => purchaseBoostProduct(company.id, product.id, 1, user.id), InsufficientCompanyPurchasedBalanceError);
      const balance = await getCompanyPurchasedBalance(company.id);
      assert.equal(balance.toString(), "0");
    } finally {
      await cleanup(company.id, [user.id], [product.id]);
    }
  });

  test("an inactive product cannot be purchased", async () => {
    const company = await createCompany();
    const user = await createUser();
    const product = await createCustomProduct({ priceCredits: 100, active: false });
    try {
      await topUp(company.id, user.id, "1000");
      await assert.rejects(() => purchaseBoostProduct(company.id, product.id, 1, user.id), BoostProductInactiveError);
    } finally {
      await cleanup(company.id, [user.id], [product.id]);
    }
  });

  test("a builtin (bump/pin) row is rejected — those have their own dedicated purchase functions", async () => {
    const company = await createCompany();
    const user = await createUser();
    const bump = await prisma.boostProduct.findFirstOrThrow({ where: { builtinEffect: "bump" } });
    try {
      await topUp(company.id, user.id, "1000");
      await assert.rejects(() => purchaseBoostProduct(company.id, bump.id, 1, user.id), BoostProductNotPurchasableHereError);
    } finally {
      await cleanup(company.id, [user.id]);
    }
  });
});
