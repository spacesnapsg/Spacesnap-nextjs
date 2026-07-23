// Coverage for company-side membership management (Sprint 6.10 follow-on,
// 2026-07-23) — search-or-create join, admin-gated removal, and the
// pending-join-request queue. Hits the real dev/test Postgres DB through
// Prisma, same convention as lib/company-credits.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  searchCompaniesByName,
  resolveCompanyMembership,
  getCompanyMembers,
  removeCompanyMember,
  getPendingCompanyJoinRequests,
  resolveCompanyJoinRequest,
  CompanyJoinRequestAlreadyPendingError,
  NotCompanyAdminError,
  CannotRemoveSelfError,
  NotInSameCompanyError,
  CompanyJoinRequestNotFoundError,
  CompanyJoinRequestNotPendingError,
} from "./company-membership";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser(overrides: Partial<{ companyId: bigint; isSupplier: boolean; isCompanyAdmin: boolean }> = {}) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Company Membership Test User",
      email: `company-membership-test-${Date.now()}-${userCounter}@example.com`,
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

describe("resolveCompanyMembership (real DB)", () => {
  test("no match: creates a new company, seats the caller immediately", async () => {
    const name = `Membership Test Co ${Date.now()}`;
    const user = await createUser();
    try {
      const result = await resolveCompanyMembership(user.id, name);
      assert.equal(result.status, "joined");
      assert.equal(result.company.name, name);

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(updated.companyId?.toString(), result.company.id);
      assert.equal(updated.isSupplier, true);
    } finally {
      await cleanupUsers([user.id]);
      const created = await prisma.company.findFirst({ where: { name } });
      if (created) await cleanupCompanies([created.id]);
    }
  });

  test("match, no admin yet: seats the caller immediately, no join request created", async () => {
    const company = await prisma.company.create({ data: { name: `Adminless Co ${Date.now()}` } });
    const existingMember = await createUser({ companyId: company.id, isSupplier: true });
    const joiner = await createUser();
    try {
      const result = await resolveCompanyMembership(joiner.id, company.name);
      assert.equal(result.status, "joined");

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: joiner.id } });
      assert.equal(updated.companyId?.toString(), company.id.toString());
      assert.equal(updated.isSupplier, true);

      const requests = await prisma.companyJoinRequest.findMany({ where: { companyId: company.id } });
      assert.equal(requests.length, 0);
    } finally {
      await cleanupUsers([existingMember.id, joiner.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("match, has an admin: queues a pending join request, does not seat the caller", async () => {
    const company = await prisma.company.create({ data: { name: `Administered Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const joiner = await createUser();
    try {
      const result = await resolveCompanyMembership(joiner.id, company.name);
      assert.equal(result.status, "pending");

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: joiner.id } });
      assert.equal(updated.companyId, null);
      assert.equal(updated.isSupplier, false);

      const requests = await prisma.companyJoinRequest.findMany({ where: { companyId: company.id } });
      assert.equal(requests.length, 1);
      assert.equal(requests[0].status, "pending");
      assert.equal(requests[0].requestedByUserId, joiner.id);
    } finally {
      await cleanupUsers([admin.id, joiner.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("a second request while one is already pending is rejected", async () => {
    const company = await prisma.company.create({ data: { name: `Duplicate Pending Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const joiner = await createUser();
    try {
      await resolveCompanyMembership(joiner.id, company.name);
      await assert.rejects(
        () => resolveCompanyMembership(joiner.id, company.name),
        CompanyJoinRequestAlreadyPendingError
      );
    } finally {
      await cleanupUsers([admin.id, joiner.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("rejects a blank name", async () => {
    const user = await createUser();
    try {
      await assert.rejects(() => resolveCompanyMembership(user.id, "   "), ApiValidationError);
    } finally {
      await cleanupUsers([user.id]);
    }
  });
});

describe("searchCompaniesByName (real DB)", () => {
  test("case-insensitive substring match", async () => {
    const company = await prisma.company.create({ data: { name: `Zephyr Coworking ${Date.now()}` } });
    try {
      const results = await searchCompaniesByName("zephyr");
      assert.ok(results.some((r) => r.id === company.id.toString()));
    } finally {
      await cleanupCompanies([company.id]);
    }
  });

  test("blank query returns nothing", async () => {
    assert.deepEqual(await searchCompaniesByName("   "), []);
  });
});

describe("removeCompanyMember (real DB)", () => {
  test("admin removes a member: clears companyId/isSupplier/isCompanyAdmin/promotionRequested", async () => {
    const company = await prisma.company.create({ data: { name: `Remove Test Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    await prisma.user.update({ where: { id: member.id }, data: { promotionRequested: true } });
    try {
      await removeCompanyMember(admin.id, member.id);
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      assert.equal(updated.companyId, null);
      assert.equal(updated.isSupplier, false);
      assert.equal(updated.isCompanyAdmin, false);
      assert.equal(updated.promotionRequested, false);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("non-admin caller is rejected", async () => {
    const company = await prisma.company.create({ data: { name: `Non Admin Co ${Date.now()}` } });
    const plain = await createUser({ companyId: company.id, isSupplier: true });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    try {
      await assert.rejects(() => removeCompanyMember(plain.id, member.id), NotCompanyAdminError);
    } finally {
      await cleanupUsers([plain.id, member.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("admin cannot remove themselves", async () => {
    const company = await prisma.company.create({ data: { name: `Self Remove Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    try {
      await assert.rejects(() => removeCompanyMember(admin.id, admin.id), CannotRemoveSelfError);
    } finally {
      await cleanupUsers([admin.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("cannot remove a member of a different company", async () => {
    const companyA = await prisma.company.create({ data: { name: `Co A ${Date.now()}` } });
    const companyB = await prisma.company.create({ data: { name: `Co B ${Date.now()}` } });
    const admin = await createUser({ companyId: companyA.id, isSupplier: true, isCompanyAdmin: true });
    const otherMember = await createUser({ companyId: companyB.id, isSupplier: true });
    try {
      await assert.rejects(() => removeCompanyMember(admin.id, otherMember.id), NotInSameCompanyError);
    } finally {
      await cleanupUsers([admin.id, otherMember.id]);
      await cleanupCompanies([companyA.id, companyB.id]);
    }
  });
});

describe("company join-request queue (real DB)", () => {
  test("approve seats the requester; reject leaves them unassociated", async () => {
    const company = await prisma.company.create({ data: { name: `Queue Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const approved = await createUser();
    const rejected = await createUser();
    try {
      await resolveCompanyMembership(approved.id, company.name);
      await resolveCompanyMembership(rejected.id, company.name);

      const pending = await getPendingCompanyJoinRequests(company.id);
      assert.equal(pending.length, 2);

      const approvedRequest = pending.find((r) => r.requestedByUserId === approved.id)!;
      const rejectedRequest = pending.find((r) => r.requestedByUserId === rejected.id)!;

      await resolveCompanyJoinRequest(admin.id, approvedRequest.id, "approved");
      await resolveCompanyJoinRequest(admin.id, rejectedRequest.id, "rejected");

      const approvedUser = await prisma.user.findUniqueOrThrow({ where: { id: approved.id } });
      assert.equal(approvedUser.companyId?.toString(), company.id.toString());
      assert.equal(approvedUser.isSupplier, true);

      const rejectedUser = await prisma.user.findUniqueOrThrow({ where: { id: rejected.id } });
      assert.equal(rejectedUser.companyId, null);

      assert.equal((await getPendingCompanyJoinRequests(company.id)).length, 0);
    } finally {
      await cleanupUsers([admin.id, approved.id, rejected.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("non-admin cannot resolve a request", async () => {
    const company = await prisma.company.create({ data: { name: `Non Admin Resolve Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const plain = await createUser({ companyId: company.id, isSupplier: true });
    const requester = await createUser();
    try {
      await resolveCompanyMembership(requester.id, company.name);
      const [request] = await getPendingCompanyJoinRequests(company.id);
      await assert.rejects(() => resolveCompanyJoinRequest(plain.id, request.id, "approved"), NotCompanyAdminError);
    } finally {
      await cleanupUsers([admin.id, plain.id, requester.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("unknown or foreign request id is rejected", async () => {
    const company = await prisma.company.create({ data: { name: `Foreign Req Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    try {
      await assert.rejects(
        () => resolveCompanyJoinRequest(admin.id, BigInt(999999999), "approved"),
        CompanyJoinRequestNotFoundError
      );
    } finally {
      await cleanupUsers([admin.id]);
      await cleanupCompanies([company.id]);
    }
  });

  test("already-resolved request cannot be resolved again", async () => {
    const company = await prisma.company.create({ data: { name: `Already Resolved Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const requester = await createUser();
    try {
      await resolveCompanyMembership(requester.id, company.name);
      const [request] = await getPendingCompanyJoinRequests(company.id);
      await resolveCompanyJoinRequest(admin.id, request.id, "approved");
      await assert.rejects(
        () => resolveCompanyJoinRequest(admin.id, request.id, "rejected"),
        CompanyJoinRequestNotPendingError
      );
    } finally {
      await cleanupUsers([admin.id, requester.id]);
      await cleanupCompanies([company.id]);
    }
  });
});

describe("getCompanyMembers (real DB)", () => {
  test("returns members ordered admin-first", async () => {
    const company = await prisma.company.create({ data: { name: `List Members Co ${Date.now()}` } });
    const admin = await createUser({ companyId: company.id, isSupplier: true, isCompanyAdmin: true });
    const member = await createUser({ companyId: company.id, isSupplier: true });
    try {
      const members = await getCompanyMembers(company.id);
      assert.equal(members.length, 2);
      assert.equal(members[0].id, admin.id);
      assert.equal(members[0].isCompanyAdmin, true);
      assert.equal(members[1].id, member.id);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupCompanies([company.id]);
    }
  });
});
