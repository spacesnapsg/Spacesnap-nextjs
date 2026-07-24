// Coverage for the marketplace enquiry queue (lib/marketplace-enquiries.ts)
// — backs components/CustomRequirementsModal.tsx's membership/consultancy
// forms, previously fake-succeeding with no backend at all (2026-07-24
// pre-UAT audit finding). Hits the real dev/test Postgres DB through Prisma,
// same convention as lib/company-membership.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, MarketplaceEnquiryType } from "../app/generated/prisma/client";
import { ApiValidationError } from "./api-errors";
import {
  createMarketplaceEnquiry,
  listPendingMarketplaceEnquiries,
  resolveMarketplaceEnquiry,
  MarketplaceEnquiryResolutionError,
} from "./marketplace-enquiries";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Marketplace Enquiry Test User",
      email: `marketplace-enquiry-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

async function cleanupUsers(userIds: string[]) {
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
}

describe("createMarketplaceEnquiry (real DB)", () => {
  test("creates a pending row for the requester", async () => {
    const user = await createUser();
    try {
      const enquiry = await createMarketplaceEnquiry(user.id, MarketplaceEnquiryType.membership, "  Need a wet lab.  ");
      assert.equal(enquiry.status, "pending");
      assert.equal(enquiry.details, "Need a wet lab.");
      assert.equal(enquiry.requestedByUserId, user.id);
      assert.equal(enquiry.contactEmail, null);
    } finally {
      await cleanupUsers([user.id]);
    }
  });

  test("rejects blank details", async () => {
    const user = await createUser();
    try {
      await assert.rejects(
        () => createMarketplaceEnquiry(user.id, MarketplaceEnquiryType.consultancy, "   "),
        ApiValidationError
      );
    } finally {
      await cleanupUsers([user.id]);
    }
  });
});

describe("marketplace enquiry queue (real DB)", () => {
  test("lists only pending enquiries, oldest first, with requester info", async () => {
    const user = await createUser();
    try {
      const first = await createMarketplaceEnquiry(user.id, MarketplaceEnquiryType.membership, "First request");
      const second = await createMarketplaceEnquiry(user.id, MarketplaceEnquiryType.consultancy, "Second request");
      await resolveMarketplaceEnquiry(first.id, user.id);

      const pending = await listPendingMarketplaceEnquiries();
      const ids = pending.map((e) => e.id.toString());
      assert.ok(!ids.includes(first.id.toString()));
      assert.ok(ids.includes(second.id.toString()));

      const found = pending.find((e) => e.id === second.id)!;
      assert.equal(found.requestedBy.email, user.email);
    } finally {
      await cleanupUsers([user.id]);
    }
  });

  test("resolving marks fulfilled and stamps the resolver", async () => {
    const requester = await createUser();
    const admin = await createUser();
    try {
      const enquiry = await createMarketplaceEnquiry(requester.id, MarketplaceEnquiryType.membership, "Resolve me");
      const resolved = await resolveMarketplaceEnquiry(enquiry.id, admin.id);
      assert.equal(resolved.status, "fulfilled");
      assert.equal(resolved.resolvedByUserId, admin.id);
      assert.ok(resolved.resolvedAt);
    } finally {
      await cleanupUsers([requester.id, admin.id]);
    }
  });

  test("cannot resolve an already-fulfilled enquiry", async () => {
    const requester = await createUser();
    const admin = await createUser();
    try {
      const enquiry = await createMarketplaceEnquiry(requester.id, MarketplaceEnquiryType.membership, "Resolve twice");
      await resolveMarketplaceEnquiry(enquiry.id, admin.id);
      await assert.rejects(
        () => resolveMarketplaceEnquiry(enquiry.id, admin.id),
        MarketplaceEnquiryResolutionError
      );
    } finally {
      await cleanupUsers([requester.id, admin.id]);
    }
  });

  test("unknown enquiry id is rejected", async () => {
    const admin = await createUser();
    try {
      await assert.rejects(
        () => resolveMarketplaceEnquiry(BigInt(999999999), admin.id),
        MarketplaceEnquiryResolutionError
      );
    } finally {
      await cleanupUsers([admin.id]);
    }
  });
});
