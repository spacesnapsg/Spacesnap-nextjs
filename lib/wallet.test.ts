// Coverage for the Sprint 3.5 known-gap #5 fix: wallet top-up creates a real
// `type: topup` Transaction row and raises the live balance (SUM of the
// ledger), instead of only ever existing via prisma/seed.ts or test fixtures.
// Hits the real dev Postgres DB through Prisma (no mocking), same as
// lib/bulk-orders.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType } from "../app/generated/prisma/client";
import { ApiValidationError } from "./api-errors";
import { getCreditBalance } from "./credits";
import { createTopUp, parseTopUpFields } from "./wallet";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Wallet Test User",
      email: `wallet-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

describe("parseTopUpFields (Sprint 3.5, known gap #5)", () => {
  test("rejects a missing amount", () => {
    assert.throws(() => parseTopUpFields({}), ApiValidationError);
  });

  test("rejects a zero or negative amount", () => {
    assert.throws(() => parseTopUpFields({ amount: 0 }), ApiValidationError);
    assert.throws(() => parseTopUpFields({ amount: -50 }), ApiValidationError);
  });

  test("rejects a non-numeric amount", () => {
    assert.throws(() => parseTopUpFields({ amount: "100" }), ApiValidationError);
  });

  test("accepts a positive amount", () => {
    const amount = parseTopUpFields({ amount: 100 });
    assert.equal(amount.toString(), "100");
  });
});

describe("createTopUp (Sprint 3.5, known gap #5)", () => {
  test("first top-up: balance goes from zero to the top-up amount, exactly one type:topup Transaction row", async () => {
    const user = await createUser();
    try {
      const balanceBefore = await getCreditBalance(user.id);
      assert.equal(balanceBefore.toString(), "0");

      const amount = parseTopUpFields({ amount: 150 });
      const { transaction, balance } = await createTopUp(user.id, amount);

      assert.equal(transaction.type, TransactionType.topup);
      assert.equal(transaction.amount.toString(), "150");
      assert.equal(transaction.userId, user.id);
      assert.equal(balance.toString(), "150");

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.topup);

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "150");
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("repeat top-up: adds to the existing balance, does not overwrite or reset it", async () => {
    const user = await createUser();
    try {
      await createTopUp(user.id, parseTopUpFields({ amount: 100 }));
      const { balance } = await createTopUp(user.id, parseTopUpFields({ amount: 50 }));

      assert.equal(balance.toString(), "150");

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 2);
      assert.ok(transactions.every((t) => t.type === TransactionType.topup));
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("decimal amount is preserved exactly (e.g. $49.99 package)", async () => {
    const user = await createUser();
    try {
      const { transaction, balance } = await createTopUp(user.id, parseTopUpFields({ amount: 49.99 }));
      assert.equal(transaction.amount.toString(), "49.99");
      assert.equal(balance.toString(), "49.99");
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
