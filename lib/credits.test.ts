// Coverage for lib/credits.ts's Buyer Org pool addition (2026-07-28) —
// getBuyerOrgPoolBalance/assertSufficientBuyerOrgPoolBalance, and the
// buyerOrganizationId: null scoping fix on getCreditBalance/
// getPurchasedBalance/getEarnedBalance (a member's own org-pool rows must
// not leak into their personal balance). Real dev/test Postgres DB via
// Prisma, same convention as every other lib/*.test.ts in this repo.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TransactionType, Prisma } from "../app/generated/prisma/client";
import {
  getCreditBalance,
  getPurchasedBalance,
  getBuyerOrgPoolBalance,
  assertSufficientBuyerOrgPoolBalance,
  InsufficientCreditBalanceError,
} from "./credits";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: { name: "Credits Test User", email: `credits-test-${Date.now()}-${userCounter}@example.com`, password: "x" },
  });
}

async function cleanup(userId: string, orgId: bigint) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.buyerOrganization.delete({ where: { id: orgId } }).catch(() => {});
}

describe("getBuyerOrgPoolBalance / personal-balance scoping (real DB)", () => {
  test("a member's own org-pool top-up/spend rows count toward the pool, not their personal balance", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Credits Test Org ${Date.now()}` } });
    const user = await createUser();
    try {
      // Personal top-up (no buyerOrganizationId) — counts toward the user's own balance.
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.purchased_topup, amount: "20.00" },
      });
      // Org pool top-up, same acting user — must NOT count toward their personal balance.
      await prisma.transaction.create({
        data: { userId: user.id, buyerOrganizationId: org.id, type: TransactionType.purchased_topup, amount: "50.00" },
      });
      // Org pool spend, same acting user.
      await prisma.transaction.create({
        data: { userId: user.id, buyerOrganizationId: org.id, type: TransactionType.purchased_spend, amount: "-15.00" },
      });

      const personalBalance = await getCreditBalance(user.id);
      assert.equal(personalBalance.toString(), "20");

      const personalPurchasedBalance = await getPurchasedBalance(user.id);
      assert.equal(personalPurchasedBalance.toString(), "20");

      const poolBalance = await getBuyerOrgPoolBalance(org.id);
      assert.equal(poolBalance.toString(), "35"); // 50 - 15
    } finally {
      await cleanup(user.id, org.id);
    }
  });

  test("assertSufficientBuyerOrgPoolBalance throws InsufficientCreditBalanceError when the pool is short", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Credits Test Org ${Date.now()}` } });
    const user = await createUser();
    try {
      await prisma.transaction.create({
        data: { userId: user.id, buyerOrganizationId: org.id, type: TransactionType.purchased_topup, amount: "10.00" },
      });

      await assert.rejects(
        () => prisma.$transaction((tx) => assertSufficientBuyerOrgPoolBalance(tx, org.id, new Prisma.Decimal("15.00"))),
        InsufficientCreditBalanceError
      );
    } finally {
      await cleanup(user.id, org.id);
    }
  });
});
