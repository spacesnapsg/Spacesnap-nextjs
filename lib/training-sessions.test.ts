// Coverage for the training-sessions module built alongside the
// training-enrollments waitlist feature (2026-07-20): supplier-facing
// session creation, gated to certificates earned via
// tier2b_operator_or_sme_signoff. Hits the real test DB through Prisma (no
// mocking), same convention as lib/training-enrollments.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CertificateEarningMethod } from "../app/generated/prisma/client";
import { ApiValidationError } from "./api-errors";
import { createTrainingSession, parseCreateSessionFields, CertificateNotEligibleForSessionError } from "./training-sessions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Training Session Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Training Session Test User",
      email: `training-session-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createCertificate(earningMethod: CertificateEarningMethod) {
  return prisma.certificate.create({
    data: { name: "Test Session Certificate", earningMethod, status: "approved" },
  });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

const VALID_FIELDS = {
  title: "Mass Spectrometry Fundamentals",
  certificateId: "1",
  sessionDatetime: "2027-12-01T09:00:00.000Z",
  location: "Boston, MA",
  capacity: 10,
  smeName: "Dr. Elena Vance",
  description: "Hands-on mass spec walkthrough.",
  endorsementName: "Mass Spec Operator Endorsement",
};

describe("parseCreateSessionFields", () => {
  test("accepts a fully-populated valid body", () => {
    const fields = parseCreateSessionFields(VALID_FIELDS);
    assert.equal(fields.title, VALID_FIELDS.title);
    assert.equal(fields.certificateId, BigInt(1));
    assert.equal(fields.capacity, 10);
    assert.equal(fields.location, "Boston, MA");
    assert.equal(fields.endorsementName, "Mass Spec Operator Endorsement");
  });

  test("accepts optional fields omitted (location, description, endorsementName)", () => {
    const { location, description, endorsementName, ...required } = VALID_FIELDS;
    void location;
    void description;
    void endorsementName;
    const fields = parseCreateSessionFields(required);
    assert.equal(fields.location, null);
    assert.equal(fields.description, null);
    assert.equal(fields.endorsementName, null);
  });

  test("rejects a missing title, certificateId, sessionDatetime, smeName", () => {
    try {
      parseCreateSessionFields({ ...VALID_FIELDS, title: "", certificateId: "", sessionDatetime: "", smeName: "" });
      assert.fail("expected ApiValidationError");
    } catch (error) {
      assert.ok(error instanceof ApiValidationError);
      assert.ok(error.errors.title);
      assert.ok(error.errors.certificateId);
      assert.ok(error.errors.sessionDatetime);
      assert.ok(error.errors.smeName);
    }
  });

  test("rejects a non-integer or zero capacity", () => {
    assert.throws(() => parseCreateSessionFields({ ...VALID_FIELDS, capacity: 0 }), ApiValidationError);
    assert.throws(() => parseCreateSessionFields({ ...VALID_FIELDS, capacity: 1.5 }), ApiValidationError);
  });

  test("rejects an unparseable sessionDatetime", () => {
    assert.throws(() => parseCreateSessionFields({ ...VALID_FIELDS, sessionDatetime: "not-a-date" }), ApiValidationError);
  });
});

describe("createTrainingSession", () => {
  test("creates a session for an approved tier2b_operator_or_sme_signoff certificate", async () => {
    const company = await createCompany();
    const user = await createUser();
    const certificate = await createCertificate(CertificateEarningMethod.tier2b_operator_or_sme_signoff);
    try {
      const fields = parseCreateSessionFields({ ...VALID_FIELDS, certificateId: certificate.id.toString() });
      const session = await createTrainingSession({ ...fields, companyId: company.id, createdByUserId: user.id });

      assert.equal(session.title, VALID_FIELDS.title);
      assert.equal(session.certificateId, certificate.id);
      assert.equal(session.companyId, company.id);

      const log = await prisma.activityLog.findMany({ where: { userId: user.id, actionType: "training_session_created" } });
      assert.equal(log.length, 1);
    } finally {
      await prisma.activityLog.deleteMany({ where: { userId: user.id } });
      await prisma.trainingSession.deleteMany({ where: { companyId: company.id } });
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects a certificate not earned via tier2b_operator_or_sme_signoff", async () => {
    const company = await createCompany();
    const user = await createUser();
    const certificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    try {
      const fields = parseCreateSessionFields({ ...VALID_FIELDS, certificateId: certificate.id.toString() });
      await assert.rejects(
        () => createTrainingSession({ ...fields, companyId: company.id, createdByUserId: user.id }),
        CertificateNotEligibleForSessionError
      );

      const sessions = await prisma.trainingSession.findMany({ where: { companyId: company.id } });
      assert.equal(sessions.length, 0, "nothing should be written when the certificate is ineligible");
    } finally {
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects a certificateId that doesn't exist", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const fields = parseCreateSessionFields({ ...VALID_FIELDS, certificateId: "999999999" });
      await assert.rejects(
        () => createTrainingSession({ ...fields, companyId: company.id, createdByUserId: user.id }),
        ApiValidationError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
