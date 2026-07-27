// Coverage for the Sprint 3.5 known-gap #5 fix: wallet top-up creates a real
// Transaction row and raises the live balance (SUM of the ledger), instead
// of only ever existing via prisma/seed.ts or test fixtures. Hits the real
// dev Postgres DB through Prisma (no mocking), same as lib/bulk-orders.test.ts.
//
// 2026-07-21: switched from `topup` to `purchased_topup` (see createTopUp's
// own comment, lib/wallet.ts) — assertions below updated to match, balance
// math is unaffected since getCreditBalance's SUM has no type filter.
//
// 2026-07-21 (later same day): credit:SGD ratio changed from 1:1 to 1:10
// (1 credit = S$0.10, lib/credit-units.ts) — parseTopUpFields now converts
// its input (entered in "credits") to true SGD before storage, so every
// amount asserted below is the input divided by 10, not the input itself.
//
// 2026-07-25 (F4): top-ups now charge a real card before crediting the wallet,
// so `purchasedBalance` is backed by collected SGD. createTopUp takes a
// paymentMethodId and makes a real Stripe test-mode charge per call — no
// mocking, same "hit the real sandbox" convention as lib/bookings.test.ts,
// using Stripe's own `pm_card_visa` / `pm_card_chargeDeclined` tokens.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType } from "../app/generated/prisma/client";
import { ApiValidationError } from "./api-errors";
import { getCreditBalance } from "./credits";
import { createTopUp, parseTopUpFields } from "./wallet";
import { StripeChargeFailedError } from "./stripe";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TEST_PAYMENT_METHOD_ID = "pm_card_visa";
const TEST_DECLINED_PAYMENT_METHOD_ID = "pm_card_chargeDeclined";

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
    assert.throws(() => parseTopUpFields({ paymentMethodId: "pm_test" }), ApiValidationError);
  });

  test("rejects a zero or negative amount", () => {
    assert.throws(() => parseTopUpFields({ amount: 0, paymentMethodId: "pm_test" }), ApiValidationError);
    assert.throws(() => parseTopUpFields({ amount: -50, paymentMethodId: "pm_test" }), ApiValidationError);
  });

  test("rejects a non-numeric amount", () => {
    assert.throws(() => parseTopUpFields({ amount: "100", paymentMethodId: "pm_test" }), ApiValidationError);
  });

  test("rejects a missing or blank paymentMethodId (F4: a real charge is now required)", () => {
    assert.throws(() => parseTopUpFields({ amount: 100 }), ApiValidationError);
    assert.throws(() => parseTopUpFields({ amount: 100, paymentMethodId: "   " }), ApiValidationError);
  });

  test("accepts a positive amount with a payment method", () => {
    const { amount, paymentMethodId } = parseTopUpFields({ amount: 100, paymentMethodId: "pm_test" });
    assert.equal(amount.toString(), "10");
    assert.equal(paymentMethodId, "pm_test");
  });
});

describe("createTopUp (F4: real Stripe charge backs the credit)", () => {
  test("first top-up: charges the card, balance goes zero -> amount, one purchased_topup row with a PaymentIntent id", async () => {
    const user = await createUser();
    try {
      const balanceBefore = await getCreditBalance(user.id);
      assert.equal(balanceBefore.toString(), "0");

      const { amount, paymentMethodId } = parseTopUpFields({ amount: 150, paymentMethodId: TEST_PAYMENT_METHOD_ID });
      const { transaction, balance } = await createTopUp(user.id, amount, paymentMethodId);

      assert.equal(transaction.type, TransactionType.purchased_topup);
      assert.equal(transaction.amount.toString(), "15");
      assert.equal(transaction.userId, user.id);
      assert.ok(transaction.stripePaymentIntentId, "the top-up row must record its Stripe PaymentIntent id");
      assert.equal(balance.toString(), "15");

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].type, TransactionType.purchased_topup);

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "15");

      // 2026-07-27 — admin-facing "wallet top-up" money-movement feed.
      const adminNotifications = await prisma.adminNotification.findMany({ where: { relatedUserId: user.id } });
      assert.equal(adminNotifications.length, 1);
      assert.equal(adminNotifications[0].type, "wallet_topup");
      assert.match(adminNotifications[0].message, new RegExp(`${user.name}.*150 credits`));
    } finally {
      await prisma.adminNotification.deleteMany({ where: { relatedUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("a declined card rejects with StripeChargeFailedError and writes no Transaction", async () => {
    const user = await createUser();
    try {
      const { amount, paymentMethodId } = parseTopUpFields({ amount: 100, paymentMethodId: TEST_DECLINED_PAYMENT_METHOD_ID });

      await assert.rejects(() => createTopUp(user.id, amount, paymentMethodId), StripeChargeFailedError);

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 0);

      const balanceAfter = await getCreditBalance(user.id);
      assert.equal(balanceAfter.toString(), "0");
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("repeat top-up: adds to the existing balance, does not overwrite or reset it", async () => {
    const user = await createUser();
    try {
      const first = parseTopUpFields({ amount: 100, paymentMethodId: TEST_PAYMENT_METHOD_ID });
      await createTopUp(user.id, first.amount, first.paymentMethodId);
      const second = parseTopUpFields({ amount: 50, paymentMethodId: TEST_PAYMENT_METHOD_ID });
      const { balance } = await createTopUp(user.id, second.amount, second.paymentMethodId);

      assert.equal(balance.toString(), "15");

      const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
      assert.equal(transactions.length, 2);
      assert.ok(transactions.every((t) => t.type === TransactionType.purchased_topup));
    } finally {
      await prisma.adminNotification.deleteMany({ where: { relatedUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("decimal amount is preserved exactly (e.g. 499.9 credits -> S$49.99 package)", async () => {
    const user = await createUser();
    try {
      const { amount, paymentMethodId } = parseTopUpFields({ amount: 499.9, paymentMethodId: TEST_PAYMENT_METHOD_ID });
      const { transaction, balance } = await createTopUp(user.id, amount, paymentMethodId);
      assert.equal(transaction.amount.toString(), "49.99");
      assert.equal(balance.toString(), "49.99");
    } finally {
      await prisma.adminNotification.deleteMany({ where: { relatedUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
