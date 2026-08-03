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
  getEarnedBalance,
  getBuyerOrgPoolBalance,
  assertSufficientBuyerOrgPoolBalance,
  InsufficientCreditBalanceError,
} from "./credits";

function yearsAgo(years: number): Date {
  return new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000);
}

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

describe("getEarnedBalance — 1-year FIFO expiry", () => {
  test("a grant older than 1 year is excluded from the balance", async () => {
    const user = await createUser();
    try {
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.earned_grant, amount: "50.00", createdAt: yearsAgo(2) },
      });

      assert.equal((await getEarnedBalance(user.id)).toString(), "0");
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("a grant within the last year still counts", async () => {
    const user = await createUser();
    try {
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.earned_grant, amount: "30.00", createdAt: yearsAgo(0.5) },
      });

      assert.equal((await getEarnedBalance(user.id)).toString(), "30"); // 0.5 years is within the 1-year window
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("FIFO: a spend consumes the oldest grant first, so a later grant it never touched still counts after the old one ages out", async () => {
    const user = await createUser();
    try {
      // Oldest first: a 20 grant two years ago, a 15 spend against it 1.5 years
      // ago (leaving 5 of that lot), then a fresh 30 grant six months ago.
      // Naively filtering out the expired grant and then subtracting every
      // spend regardless of which lot it drew from would net to 30 - 15 = 15
      // — wrong, because the spend already consumed the (now-expired) old
      // lot, not the still-live one. FIFO gives the correct 30.
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.earned_grant, amount: "20.00", createdAt: yearsAgo(2) },
      });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.earned_spend, amount: "-15.00", createdAt: yearsAgo(1.5) },
      });
      await prisma.transaction.create({
        data: { userId: user.id, type: TransactionType.earned_grant, amount: "30.00", createdAt: yearsAgo(0.5) },
      });

      assert.equal((await getEarnedBalance(user.id)).toString(), "30");
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
