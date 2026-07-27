// Coverage for the tier2a1_internal_company_signoff earning path (session:
// feat/internal-training-signoff) — a buyer-org admin (CA) running in-house
// training for their own organization's staff. Hits the real test DB
// through Prisma, same convention as the rest of this project's
// lib/*.test.ts files (no mocking).
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  CertificateEarningMethod,
  CredentialProvenance,
  SignoffSubmissionType,
} from "../app/generated/prisma/client";
import {
  addParticipant,
  createInternalTrainingEvent,
  EvidenceRequiredForPassError,
  InternalTrainingCertificateNotApprovedError,
  isAuthorizedForEvidenceUpload,
  ParticipantAlreadyAddedError,
  ParticipantAlreadyReviewedError,
  ParticipantNotInOrganizationError,
  reviewParticipant,
  SelfSignoffNotAllowedError,
  uploadParticipantEvidence,
} from "./internal-training-events";
import { issueCredential } from "./training-credentials";
import { submitSignoffRequest } from "./certificate-signoffs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

async function createOrg(name = "Test Buyer Org") {
  return prisma.buyerOrganization.create({ data: { name } });
}

async function createOrgUser(buyerOrganizationId: bigint, opts: { isBuyerOrgAdmin?: boolean } = {}) {
  return prisma.user.create({
    data: {
      name: "Internal Training Test User",
      email: `internal-training-test-${uniqueSuffix()}@example.com`,
      password: "x",
      buyerOrganizationId,
      isBuyerOrgAdmin: opts.isBuyerOrgAdmin ?? false,
    },
  });
}

async function createOutsideUser() {
  return prisma.user.create({
    data: {
      name: "Outside Test User",
      email: `internal-training-outside-${uniqueSuffix()}@example.com`,
      password: "x",
    },
  });
}

function createCertificate(
  opts: { status?: "approved" | "pending"; earningMethod?: CertificateEarningMethod } = {}
) {
  return prisma.certificate.create({
    data: {
      name: "Test Internal Training Certificate",
      status: opts.status ?? "approved",
      earningMethod: opts.earningMethod ?? CertificateEarningMethod.tier2a_operator_signoff,
    },
  });
}

async function createEvent(buyerOrganizationId: bigint, createdByUserId: string, certificateId: bigint) {
  return createInternalTrainingEvent({
    buyerOrganizationId,
    createdByUserId,
    title: "Pipette Gravimetric Check",
    trainingDate: new Date("2026-08-01"),
    certificateId,
    equipmentDetails: "1000ul pipette, gravimetric method",
    trainerName: "Senior Scientist Jane",
  });
}

async function cleanupEvent(eventId: bigint) {
  await prisma.internalTrainingParticipant.deleteMany({ where: { eventId } });
  await prisma.internalTrainingEvent.deleteMany({ where: { id: eventId } });
}

async function cleanupUser(userId: string) {
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.userCertificate.deleteMany({ where: { userId } });
  await prisma.certificateSignoffRequest.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

describe("isAuthorizedForEvidenceUpload (pure)", () => {
  test("the participant themselves is authorized", () => {
    const ok = isAuthorizedForEvidenceUpload({
      participantUserId: "user-1",
      eventBuyerOrganizationId: BigInt(5),
      actingUserId: "user-1",
      actingIsBuyerOrgAdmin: false,
      actingBuyerOrganizationId: null,
    });
    assert.equal(ok, true);
  });

  test("a CA of the event's own organization is authorized", () => {
    const ok = isAuthorizedForEvidenceUpload({
      participantUserId: "user-1",
      eventBuyerOrganizationId: BigInt(5),
      actingUserId: "ca-1",
      actingIsBuyerOrgAdmin: true,
      actingBuyerOrganizationId: "5",
    });
    assert.equal(ok, true);
  });

  test("a CA of a different organization is rejected", () => {
    const ok = isAuthorizedForEvidenceUpload({
      participantUserId: "user-1",
      eventBuyerOrganizationId: BigInt(5),
      actingUserId: "ca-1",
      actingIsBuyerOrgAdmin: true,
      actingBuyerOrganizationId: "999",
    });
    assert.equal(ok, false);
  });

  test("a non-admin member who isn't the participant is rejected", () => {
    const ok = isAuthorizedForEvidenceUpload({
      participantUserId: "user-1",
      eventBuyerOrganizationId: BigInt(5),
      actingUserId: "user-2",
      actingIsBuyerOrgAdmin: false,
      actingBuyerOrganizationId: "5",
    });
    assert.equal(ok, false);
  });
});

describe("createInternalTrainingEvent", () => {
  test("rejects a certificate that isn't approved", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const certificate = await createCertificate({ status: "pending" });
    try {
      await assert.rejects(
        () => createEvent(org.id, ca.id, certificate.id),
        InternalTrainingCertificateNotApprovedError
      );
    } finally {
      await cleanupUser(ca.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });
});

describe("addParticipant", () => {
  test("rejects a userId outside the CA's own organization", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    const outsider = await createOutsideUser();
    try {
      await assert.rejects(
        () => addParticipant({ eventId: event.id, buyerOrganizationId: org.id, userId: outsider.id, actingUserId: ca.id }),
        ParticipantNotInOrganizationError
      );
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(outsider.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });

  test("rejects the CA adding themselves as a participant", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      await assert.rejects(
        () => addParticipant({ eventId: event.id, buyerOrganizationId: org.id, userId: ca.id, actingUserId: ca.id }),
        SelfSignoffNotAllowedError
      );
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });

  test("rejects adding the same participant twice", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const staff = await createOrgUser(org.id);
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      await addParticipant({ eventId: event.id, buyerOrganizationId: org.id, userId: staff.id, actingUserId: ca.id });
      await assert.rejects(
        () => addParticipant({ eventId: event.id, buyerOrganizationId: org.id, userId: staff.id, actingUserId: ca.id }),
        ParticipantAlreadyAddedError
      );
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(staff.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });
});

describe("reviewParticipant", () => {
  test("fail is allowed with no evidence uploaded", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const staff = await createOrgUser(org.id);
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      const participant = await addParticipant({
        eventId: event.id,
        buyerOrganizationId: org.id,
        userId: staff.id,
        actingUserId: ca.id,
      });

      const reviewed = await reviewParticipant({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        reviewerId: ca.id,
        decision: "fail",
      });
      assert.equal(reviewed.status, "failed");

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: staff.id, certificateId: certificate.id } },
      });
      assert.equal(credential, null);
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(staff.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });

  test("pass is blocked while evidenceKey is null", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const staff = await createOrgUser(org.id);
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      const participant = await addParticipant({
        eventId: event.id,
        buyerOrganizationId: org.id,
        userId: staff.id,
        actingUserId: ca.id,
      });

      await assert.rejects(
        () =>
          reviewParticipant({
            participantId: participant.id,
            buyerOrganizationId: org.id,
            reviewerId: ca.id,
            decision: "pass",
          }),
        EvidenceRequiredForPassError
      );

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: staff.id, certificateId: certificate.id } },
      });
      assert.equal(credential, null);
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(staff.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });

  test("pass with evidence issues a credential with internal provenance", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const staff = await createOrgUser(org.id);
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      const participant = await addParticipant({
        eventId: event.id,
        buyerOrganizationId: org.id,
        userId: staff.id,
        actingUserId: ca.id,
      });

      const withEvidence = await uploadParticipantEvidence({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        evidenceKey: "internal-training-evidence/x/y/photo.jpg",
        uploadedByUserId: staff.id,
      });
      assert.equal(withEvidence.status, "awaiting_signoff");

      const reviewed = await reviewParticipant({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        reviewerId: ca.id,
        decision: "pass",
        reviewNote: "Nailed the gravimetric check.",
      });
      assert.equal(reviewed.status, "passed");

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: staff.id, certificateId: certificate.id } },
      });
      assert.ok(credential);
      assert.equal(credential!.earnedVia, CredentialProvenance.tier2a1_internal_company_signoff);
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(staff.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });

  test("a terminal (passed) participant rejects any further review", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const staff = await createOrgUser(org.id);
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      const participant = await addParticipant({
        eventId: event.id,
        buyerOrganizationId: org.id,
        userId: staff.id,
        actingUserId: ca.id,
      });
      await reviewParticipant({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        reviewerId: ca.id,
        decision: "fail",
      });

      await assert.rejects(
        () =>
          reviewParticipant({
            participantId: participant.id,
            buyerOrganizationId: org.id,
            reviewerId: ca.id,
            decision: "fail",
          }),
        ParticipantAlreadyReviewedError
      );
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(staff.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });

  test("a user already holding the cert via operator sign-off keeps operator provenance on renewal", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const staff = await createOrgUser(org.id);
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      // staff already holds the credential via the stronger operator-signoff path
      await prisma.$transaction((tx) =>
        issueCredential(tx, {
          userId: staff.id,
          certificateId: certificate.id,
          description: "Earned via operator sign-off.",
          provenance: CredentialProvenance.tier2a_operator_signoff,
        })
      );

      const participant = await addParticipant({
        eventId: event.id,
        buyerOrganizationId: org.id,
        userId: staff.id,
        actingUserId: ca.id,
      });
      await uploadParticipantEvidence({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        evidenceKey: "internal-training-evidence/x/y/photo.jpg",
        uploadedByUserId: staff.id,
      });
      await reviewParticipant({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        reviewerId: ca.id,
        decision: "pass",
      });

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: staff.id, certificateId: certificate.id } },
      });
      assert.equal(
        credential!.earnedVia,
        CredentialProvenance.tier2a_operator_signoff,
        "internal sign-off must never downgrade an existing stronger provenance"
      );
    } finally {
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(staff.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });

  test("coexists with a pending CertificateSignoffRequest for the same (user, certificate)", async () => {
    const org = await createOrg();
    const ca = await createOrgUser(org.id, { isBuyerOrgAdmin: true });
    const staff = await createOrgUser(org.id);
    const certificate = await createCertificate();
    const event = await createEvent(org.id, ca.id, certificate.id);
    try {
      const signoffRequest = await submitSignoffRequest({
        userId: staff.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.live_demo_request,
        recordingKey: null,
      });
      assert.equal(signoffRequest.status, "pending");

      const participant = await addParticipant({
        eventId: event.id,
        buyerOrganizationId: org.id,
        userId: staff.id,
        actingUserId: ca.id,
      });
      await uploadParticipantEvidence({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        evidenceKey: "internal-training-evidence/x/y/photo.jpg",
        uploadedByUserId: staff.id,
      });
      const reviewed = await reviewParticipant({
        participantId: participant.id,
        buyerOrganizationId: org.id,
        reviewerId: ca.id,
        decision: "pass",
      });
      assert.equal(reviewed.status, "passed");

      // The internal-training path issued the credential; the operator
      // signoff request itself is untouched, still pending.
      const stillPending = await prisma.certificateSignoffRequest.findUnique({
        where: { userId_certificateId: { userId: staff.id, certificateId: certificate.id } },
      });
      assert.equal(stillPending!.status, "pending");

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: staff.id, certificateId: certificate.id } },
      });
      assert.equal(credential!.earnedVia, CredentialProvenance.tier2a1_internal_company_signoff);
    } finally {
      await prisma.certificateSignoffRequest.deleteMany({ where: { userId: staff.id } });
      await cleanupEvent(event.id);
      await cleanupUser(ca.id);
      await cleanupUser(staff.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await prisma.buyerOrganization.delete({ where: { id: org.id } });
    }
  });
});
