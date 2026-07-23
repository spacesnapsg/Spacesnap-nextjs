// Coverage for the 2026-07-23 amendment to lib/promotions.ts: requestPromotion
// (self-service, system-admin queue) is now gated to only work when the
// company has no admin at all; promoteMemberDirectly is the new admin-driven
// path once one exists. Real dev/test Postgres DB via Prisma.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  requestPromotion,
  promoteMemberDirectly,
  approvePromotion,
  AlreadyCompanyAdminError,
  PromotionAlreadyRequestedError,
  CompanyAlreadyHasAdminError,
  NotCompanyAdminError,
  TargetNotInCompanyError,
} from "./promotions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser(overrides: Partial<{ companyId: bigint; isSupplier: boolean; isCompanyAdmin: boolean }> = {}) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Promotions Test User",
      email: `promotions-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
      ...overrides,
    },
  });
}

async function cleanupUsers(userIds: string[]) {
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
}

async function cleanupCompanies(companyIds: bigint[]) {
  for (const id of companyIds) {
    await prisma.company.delete({ where: { id } }).catch(() => {});
  }
}

describe("requestPromotion — gated on the company having no admin (real DB)", () => {
  test("allowed, and reaches the system-admin queue, when the company has no admin yet", async () => {
    const company = await prisma.company.create({ data: { name: `No Admin Yet Co ${Date.now()}` } });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    try {
      const updated = await requestPromotion(member.id);
      assert.equal(updated.promotionRequested, true);

      const approved = await approvePromotion(member.id);
      assert.equal(approved?.isCompanyAdmin, true);
    } finally {
      await cleanupUsers([member.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("rejected once the company already has an admin", async () => {
    const company = await prisma.company.create({ data: { name: `Has Admin Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    try {
      await assert.rejects(() => requestPromotion(member.id), CompanyAlreadyHasAdminError);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("already-admin caller is rejected regardless of the company's admin state", async () => {
    const company = await prisma.company.create({ data: { name: `Already Admin Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    try {
      await assert.rejects(() => requestPromotion(admin.id), AlreadyCompanyAdminError);
    } finally {
      await cleanupUsers([admin.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("a duplicate request while one is pending is rejected", async () => {
    const company = await prisma.company.create({ data: { name: `Dup Request Co ${Date.now()}` } });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    try {
      await requestPromotion(member.id);
      await assert.rejects(() => requestPromotion(member.id), PromotionAlreadyRequestedError);
    } finally {
      await cleanupUsers([member.id]);
      await cleanupCompanies([company.id]);
    }
  });
});

describe("promoteMemberDirectly — admin-driven, no system-admin round trip (real DB)", () => {
  test("an existing admin promotes a fellow member directly", async () => {
    const company = await prisma.company.create({ data: { name: `Direct Promote Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    try {
      const updated = await promoteMemberDirectly(admin.id, member.id);
      assert.equal(updated.isCompanyAdmin, true);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("a non-admin caller cannot promote anyone", async () => {
    const company = await prisma.company.create({ data: { name: `Non Admin Promote Co ${Date.now()}` } });
    const plain = await createUser({ companyId: company.id, isSupplier: true });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    try {
      await assert.rejects(() => promoteMemberDirectly(plain.id, member.id), NotCompanyAdminError);
    } finally {
      await cleanupUsers([plain.id, member.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("cannot promote a member of a different company", async () => {
    const companyA = await prisma.company.create({ data: { name: `Promote Co A ${Date.now()}` } });
    const companyB = await prisma.company.create({ data: { name: `Promote Co B ${Date.now()}` } });
    const admin = await createUser({ companyId: companyA.id, isSupplier: true, isCompanyAdmin: true });
    const outsider = await createUser({ companyId: companyB.id, isSupplier: true });
    try {
      await assert.rejects(() => promoteMemberDirectly(admin.id, outsider.id), TargetNotInCompanyError);
    } finally {
      await cleanupUsers([admin.id, outsider.id]);
      await cleanupCompanies([companyA.id, companyB.id]);
    }
  });

  test("cannot promote someone who is already an admin", async () => {
    const company = await prisma.company.create({ data: { name: `Already Admin Target Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const otherAdmin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    try {
      await assert.rejects(() => promoteMemberDirectly(admin.id, otherAdmin.id), AlreadyCompanyAdminError);
    } finally {
      await cleanupUsers([admin.id, otherAdmin.id]);
      await cleanupCompanies([company.id]);
    }
  });
});
