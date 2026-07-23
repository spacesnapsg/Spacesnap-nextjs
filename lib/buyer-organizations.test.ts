// Coverage for lib/buyer-organizations.ts (Sprint 6.10 "User-Side Buyer
// Organization", 2026-07-23) — structural mirror of
// lib/company-membership.test.ts / lib/promotions.test.ts, scoped to
// BuyerOrganization. Real dev/test Postgres DB via Prisma.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  searchBuyerOrganizationsByName,
  resolveBuyerOrgMembership,
  getBuyerOrgMembers,
  removeBuyerOrgMember,
  getPendingBuyerOrgJoinRequests,
  resolveBuyerOrgJoinRequest,
  requestBuyerOrgPromotion,
  approveBuyerOrgPromotion,
  promoteBuyerOrgMemberDirectly,
  BuyerOrgJoinRequestAlreadyPendingError,
  NotBuyerOrgAdminError,
  CannotRemoveSelfError,
  NotInSameOrgError,
  BuyerOrgJoinRequestNotFoundError,
  BuyerOrgJoinRequestNotPendingError,
  AlreadyBuyerOrgAdminError,
  BuyerOrgAlreadyHasAdminError,
  BuyerOrgPromotionAlreadyRequestedError,
} from "./buyer-organizations";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser(
  overrides: Partial<{ buyerOrganizationId: bigint; isBuyerOrgAdmin: boolean }> = {}
) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Buyer Org Test User",
      email: `buyer-org-test-${Date.now()}-${userCounter}@example.com`,
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

async function cleanupOrgs(orgIds: bigint[]) {
  for (const id of orgIds) {
    await prisma.buyerOrganization.delete({ where: { id } }).catch(() => {});
  }
}

describe("resolveBuyerOrgMembership (real DB)", () => {
  test("no match: creates a new organization, seats the caller immediately", async () => {
    const name = `Membership Test Org ${Date.now()}`;
    const user = await createUser();
    try {
      const result = await resolveBuyerOrgMembership(user.id, name);
      assert.equal(result.status, "joined");
      assert.equal(result.organization.name, name);

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(updated.buyerOrganizationId?.toString(), result.organization.id);
    } finally {
      await cleanupUsers([user.id]);
      const org = await prisma.buyerOrganization.findFirst({ where: { name } });
      if (org) await cleanupOrgs([org.id]);
    }
  });

  test("match, no admin yet: seats the caller immediately, no join request created", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Adminless Org ${Date.now()}` } });
    const existingMember = await createUser({ buyerOrganizationId: org.id });
    const joiner = await createUser();
    try {
      const result = await resolveBuyerOrgMembership(joiner.id, org.name);
      assert.equal(result.status, "joined");

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: joiner.id } });
      assert.equal(updated.buyerOrganizationId?.toString(), org.id.toString());

      const requests = await prisma.buyerOrganizationJoinRequest.findMany({
        where: { buyerOrganizationId: org.id },
      });
      assert.equal(requests.length, 0);
    } finally {
      await cleanupUsers([existingMember.id, joiner.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("match, has an admin: queues a pending join request, does not seat the caller", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Administered Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const joiner = await createUser();
    try {
      const result = await resolveBuyerOrgMembership(joiner.id, org.name);
      assert.equal(result.status, "pending");

      const updated = await prisma.user.findUniqueOrThrow({ where: { id: joiner.id } });
      assert.equal(updated.buyerOrganizationId, null);

      const requests = await prisma.buyerOrganizationJoinRequest.findMany({
        where: { buyerOrganizationId: org.id },
      });
      assert.equal(requests.length, 1);
      assert.equal(requests[0].status, "pending");
    } finally {
      await cleanupUsers([admin.id, joiner.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("a second request while one is already pending is rejected", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Duplicate Pending Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const joiner = await createUser();
    try {
      await resolveBuyerOrgMembership(joiner.id, org.name);
      await assert.rejects(
        () => resolveBuyerOrgMembership(joiner.id, org.name),
        BuyerOrgJoinRequestAlreadyPendingError
      );
    } finally {
      await cleanupUsers([admin.id, joiner.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("rejects a blank name", async () => {
    const user = await createUser();
    try {
      await assert.rejects(() => resolveBuyerOrgMembership(user.id, "   "), ApiValidationError);
    } finally {
      await cleanupUsers([user.id]);
    }
  });
});

describe("searchBuyerOrganizationsByName (real DB)", () => {
  test("case-insensitive substring match", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Zephyr Buyers ${Date.now()}` } });
    try {
      const results = await searchBuyerOrganizationsByName("zephyr");
      assert.ok(results.some((r) => r.id === org.id.toString()));
    } finally {
      await cleanupOrgs([org.id]);
    }
  });
});

describe("removeBuyerOrgMember (real DB)", () => {
  test("admin removes a member: clears buyerOrganizationId/isBuyerOrgAdmin/buyerOrgPromotionRequested", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Remove Test Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    await prisma.user.update({ where: { id: member.id }, data: { buyerOrgPromotionRequested: true } });
    try {
      await removeBuyerOrgMember(admin.id, member.id);
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
      assert.equal(updated.buyerOrganizationId, null);
      assert.equal(updated.isBuyerOrgAdmin, false);
      assert.equal(updated.buyerOrgPromotionRequested, false);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("non-admin caller is rejected", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Non Admin Org ${Date.now()}` } });
    const plain = await createUser({ buyerOrganizationId: org.id });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      await assert.rejects(() => removeBuyerOrgMember(plain.id, member.id), NotBuyerOrgAdminError);
    } finally {
      await cleanupUsers([plain.id, member.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("admin cannot remove themselves", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Self Remove Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    try {
      await assert.rejects(() => removeBuyerOrgMember(admin.id, admin.id), CannotRemoveSelfError);
    } finally {
      await cleanupUsers([admin.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("cannot remove a member of a different organization", async () => {
    const orgA = await prisma.buyerOrganization.create({ data: { name: `Org A ${Date.now()}` } });
    const orgB = await prisma.buyerOrganization.create({ data: { name: `Org B ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: orgA.id, isBuyerOrgAdmin: true });
    const outsider = await createUser({ buyerOrganizationId: orgB.id });
    try {
      await assert.rejects(() => removeBuyerOrgMember(admin.id, outsider.id), NotInSameOrgError);
    } finally {
      await cleanupUsers([admin.id, outsider.id]);
      await cleanupOrgs([orgA.id, orgB.id]);
    }
  });
});

describe("buyer org join-request queue (real DB)", () => {
  test("approve seats the requester; reject leaves them unassociated", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Queue Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const approved = await createUser();
    const rejected = await createUser();
    try {
      await resolveBuyerOrgMembership(approved.id, org.name);
      await resolveBuyerOrgMembership(rejected.id, org.name);

      const pending = await getPendingBuyerOrgJoinRequests(org.id);
      assert.equal(pending.length, 2);

      const approvedRequest = pending.find((r) => r.requestedByUserId === approved.id)!;
      const rejectedRequest = pending.find((r) => r.requestedByUserId === rejected.id)!;

      await resolveBuyerOrgJoinRequest(admin.id, approvedRequest.id, "approved");
      await resolveBuyerOrgJoinRequest(admin.id, rejectedRequest.id, "rejected");

      const approvedUser = await prisma.user.findUniqueOrThrow({ where: { id: approved.id } });
      assert.equal(approvedUser.buyerOrganizationId?.toString(), org.id.toString());

      const rejectedUser = await prisma.user.findUniqueOrThrow({ where: { id: rejected.id } });
      assert.equal(rejectedUser.buyerOrganizationId, null);

      assert.equal((await getPendingBuyerOrgJoinRequests(org.id)).length, 0);
    } finally {
      await cleanupUsers([admin.id, approved.id, rejected.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("unknown or foreign request id is rejected", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Foreign Req Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    try {
      await assert.rejects(
        () => resolveBuyerOrgJoinRequest(admin.id, BigInt(999999999), "approved"),
        BuyerOrgJoinRequestNotFoundError
      );
    } finally {
      await cleanupUsers([admin.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("already-resolved request cannot be resolved again", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Already Resolved Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const requester = await createUser();
    try {
      await resolveBuyerOrgMembership(requester.id, org.name);
      const [request] = await getPendingBuyerOrgJoinRequests(org.id);
      await resolveBuyerOrgJoinRequest(admin.id, request.id, "approved");
      await assert.rejects(
        () => resolveBuyerOrgJoinRequest(admin.id, request.id, "rejected"),
        BuyerOrgJoinRequestNotPendingError
      );
    } finally {
      await cleanupUsers([admin.id, requester.id]);
      await cleanupOrgs([org.id]);
    }
  });
});

describe("getBuyerOrgMembers (real DB)", () => {
  test("returns members ordered admin-first", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `List Members Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const members = await getBuyerOrgMembers(org.id);
      assert.equal(members.length, 2);
      assert.equal(members[0].id, admin.id);
      assert.equal(members[1].id, member.id);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupOrgs([org.id]);
    }
  });
});

describe("buyer org promotion — gated on the org having no admin (real DB)", () => {
  test("allowed, and reaches the system-admin queue, when the org has no admin yet", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `No Admin Yet Org ${Date.now()}` } });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const updated = await requestBuyerOrgPromotion(member.id);
      assert.equal(updated.buyerOrgPromotionRequested, true);

      const approved = await approveBuyerOrgPromotion(member.id);
      assert.equal(approved?.isBuyerOrgAdmin, true);
    } finally {
      await cleanupUsers([member.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("rejected once the org already has an admin", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Has Admin Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      await assert.rejects(() => requestBuyerOrgPromotion(member.id), BuyerOrgAlreadyHasAdminError);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("a duplicate request while one is pending is rejected", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Dup Request Org ${Date.now()}` } });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      await requestBuyerOrgPromotion(member.id);
      await assert.rejects(() => requestBuyerOrgPromotion(member.id), BuyerOrgPromotionAlreadyRequestedError);
    } finally {
      await cleanupUsers([member.id]);
      await cleanupOrgs([org.id]);
    }
  });
});

describe("promoteBuyerOrgMemberDirectly — admin-driven, no system-admin round trip (real DB)", () => {
  test("an existing admin promotes a fellow member directly", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Direct Promote Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      const updated = await promoteBuyerOrgMemberDirectly(admin.id, member.id);
      assert.equal(updated.isBuyerOrgAdmin, true);
    } finally {
      await cleanupUsers([admin.id, member.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("a non-admin caller cannot promote anyone", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Non Admin Promote Org ${Date.now()}` } });
    const plain = await createUser({ buyerOrganizationId: org.id });
    const member = await createUser({ buyerOrganizationId: org.id });
    try {
      await assert.rejects(() => promoteBuyerOrgMemberDirectly(plain.id, member.id), NotBuyerOrgAdminError);
    } finally {
      await cleanupUsers([plain.id, member.id]);
      await cleanupOrgs([org.id]);
    }
  });

  test("cannot promote someone already an admin", async () => {
    const org = await prisma.buyerOrganization.create({ data: { name: `Already Admin Target Org ${Date.now()}` } });
    const admin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    const otherAdmin = await createUser({ buyerOrganizationId: org.id, isBuyerOrgAdmin: true });
    try {
      await assert.rejects(() => promoteBuyerOrgMemberDirectly(admin.id, otherAdmin.id), AlreadyBuyerOrgAdminError);
    } finally {
      await cleanupUsers([admin.id, otherAdmin.id]);
      await cleanupOrgs([org.id]);
    }
  });
});
