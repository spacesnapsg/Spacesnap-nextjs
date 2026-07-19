// Coverage for the shared credential-issuance helper (Sprint 4, Item 4),
// reused by both lib/quiz-attempts.ts and lib/training-enrollments.ts. Hits
// the real test DB through Prisma, same convention as the rest of this
// project's lib/*.test.ts files.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { issueCredential } from "./training-credentials";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Training Credential Test User",
      email: `training-credential-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

async function createCertificate() {
  return prisma.certificate.create({ data: { name: "Test Issuance Certificate" } });
}

async function cleanup(userId: string, certificateId: bigint) {
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.userCertificate.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.certificate.delete({ where: { id: certificateId } });
}

describe("issueCredential", () => {
  test("creates a UserCertificate and a credential_issued activity row on a first issuance", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      await prisma.$transaction((tx) =>
        issueCredential(tx, { userId: user.id, certificateId: certificate.id, description: "Test issuance." })
      );

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.ok(credential);
      assert.equal(credential!.expiryDate, null);

      const log = await prisma.activityLog.findMany({ where: { userId: user.id } });
      assert.equal(log.length, 1);
      assert.equal(log[0].actionType, "credential_issued");
      assert.equal(log[0].description, "Test issuance.");
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("re-issuing an already-held (expired) credential renews it via upsert, not a duplicate row", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      await prisma.userCertificate.create({
        data: {
          userId: user.id,
          certificateId: certificate.id,
          earnedDate: new Date("2020-01-01"),
          expiryDate: new Date("2021-01-01"),
        },
      });

      await prisma.$transaction((tx) =>
        issueCredential(tx, { userId: user.id, certificateId: certificate.id, description: "Renewal." })
      );

      const rows = await prisma.userCertificate.findMany({ where: { userId: user.id, certificateId: certificate.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].expiryDate, null);
      assert.ok(rows[0].earnedDate.getFullYear() >= 2026);
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });
});
