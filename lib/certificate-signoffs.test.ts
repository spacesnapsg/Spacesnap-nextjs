// Coverage for Sprint 4, Item 4's tier2a_operator_signoff earning path: an
// on-demand, per-user sign-off request (live demo or uploaded-recording
// evidence), reviewed by an operator. Hits the real test DB through Prisma
// (no mocking, no R2 — recordingKey is a plain string here, storage I/O
// lives at the route layer, see lib/certificate-signoffs.ts's own comment).
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CertificateEarningMethod, SignoffSubmissionType } from "../app/generated/prisma/client";
import {
  parseSignoffSubmission,
  submitSignoffRequest,
  reviewSignoffRequest,
  SignoffCertificateNotFoundError,
  SignoffWrongEarningMethodError,
  SignoffRequestInProgressError,
  SignoffRequestNotFoundError,
  InvalidSignoffTransitionError,
} from "./certificate-signoffs";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Signoff Test User",
      email: `signoff-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createCertificate(earningMethod: CertificateEarningMethod = CertificateEarningMethod.tier2a_operator_signoff) {
  return prisma.certificate.create({ data: { name: "Test Signoff Certificate", earningMethod } });
}

async function cleanup(userId: string, certificateId: bigint) {
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.userCertificate.deleteMany({ where: { userId } });
  await prisma.certificateSignoffRequest.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.certificate.delete({ where: { id: certificateId } });
}

describe("parseSignoffSubmission", () => {
  test("accepts a live_demo_request with no recordingKey", () => {
    const parsed = parseSignoffSubmission({ submissionType: "live_demo_request" });
    assert.equal(parsed.submissionType, "live_demo_request");
    assert.equal(parsed.recordingKey, null);
  });

  test("accepts a recording submission with a recordingKey", () => {
    const parsed = parseSignoffSubmission({ submissionType: "recording", recordingKey: "signoff-evidence/1/2/abc.mp4" });
    assert.equal(parsed.recordingKey, "signoff-evidence/1/2/abc.mp4");
  });

  test("rejects a recording submission with no recordingKey", () => {
    assert.throws(() => parseSignoffSubmission({ submissionType: "recording" }), ApiValidationError);
  });

  test("rejects an invalid submissionType", () => {
    assert.throws(() => parseSignoffSubmission({ submissionType: "carrier_pigeon" }), ApiValidationError);
  });
});

describe("submitSignoffRequest", () => {
  test("a live_demo_request submission creates a pending row with no recording", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.live_demo_request,
        recordingKey: null,
      });
      assert.equal(request.status, "pending");
      assert.equal(request.recordingKey, null);

      const log = await prisma.activityLog.findMany({ where: { userId: user.id } });
      assert.equal(log.length, 1);
      assert.equal(log[0].actionType, "signoff_requested");
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("a recording submission creates a pending row with the recording key stored", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.recording,
        recordingKey: "signoff-evidence/x/y/video.mp4",
      });
      assert.equal(request.recordingKey, "signoff-evidence/x/y/video.mp4");
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("rejects a certificate whose earning method isn't tier2a_operator_signoff", async () => {
    const user = await createUser();
    const certificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    try {
      await assert.rejects(
        () =>
          submitSignoffRequest({
            userId: user.id,
            certificateId: certificate.id,
            submissionType: SignoffSubmissionType.live_demo_request,
            recordingKey: null,
          }),
        SignoffWrongEarningMethodError
      );
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("rejects a nonexistent certificate", async () => {
    const user = await createUser();
    try {
      await assert.rejects(
        () =>
          submitSignoffRequest({
            userId: user.id,
            certificateId: BigInt(999999999),
            submissionType: SignoffSubmissionType.live_demo_request,
            recordingKey: null,
          }),
        SignoffCertificateNotFoundError
      );
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("a second submission while one is already pending is rejected", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.live_demo_request,
        recordingKey: null,
      });

      await assert.rejects(
        () =>
          submitSignoffRequest({
            userId: user.id,
            certificateId: certificate.id,
            submissionType: SignoffSubmissionType.recording,
            recordingKey: "signoff-evidence/x/y/video.mp4",
          }),
        SignoffRequestInProgressError
      );

      const rows = await prisma.certificateSignoffRequest.findMany({ where: { userId: user.id } });
      assert.equal(rows.length, 1);
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("resubmitting after a failed outcome resets the same row rather than creating a second one", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const first = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.live_demo_request,
        recordingKey: null,
      });
      await reviewSignoffRequest({ requestId: first.id, reviewerId: user.id, decision: "fail" });

      const resubmitted = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.recording,
        recordingKey: "signoff-evidence/retry/video.mp4",
      });

      assert.equal(resubmitted.id, first.id, "expected the same row to be reset, not a new one");
      assert.equal(resubmitted.status, "pending");
      assert.equal(resubmitted.submissionType, "recording");
      assert.equal(resubmitted.reviewedBy, null);
      assert.equal(resubmitted.reviewedAt, null);

      const rows = await prisma.certificateSignoffRequest.findMany({ where: { userId: user.id } });
      assert.equal(rows.length, 1);
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });
});

describe("reviewSignoffRequest — transition rules", () => {
  test("recording + pending: pass issues a credential", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.recording,
        recordingKey: "signoff-evidence/a/b/video.mp4",
      });

      const updated = await reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "pass" });
      assert.equal(updated.status, "passed");

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.ok(credential);
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("recording + pending: request_live_demo escalates without issuing a credential", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.recording,
        recordingKey: "signoff-evidence/a/b/video.mp4",
      });

      const updated = await reviewSignoffRequest({
        requestId: request.id,
        reviewerId: user.id,
        decision: "request_live_demo",
      });
      assert.equal(updated.status, "live_demo_requested");

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.equal(credential, null);
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("recording + pending: an outright fail is rejected — a recording review can only pass or escalate", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.recording,
        recordingKey: "signoff-evidence/a/b/video.mp4",
      });

      await assert.rejects(
        () => reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "fail" }),
        InvalidSignoffTransitionError
      );

      const row = await prisma.certificateSignoffRequest.findUnique({ where: { id: request.id } });
      assert.equal(row!.status, "pending");
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("live_demo_request + pending: fail is allowed (the demo already happened) and issues nothing", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.live_demo_request,
        recordingKey: null,
      });

      const updated = await reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "fail" });
      assert.equal(updated.status, "failed");

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.equal(credential, null);
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("live_demo_request + pending: request_live_demo is rejected — it's already a live demo", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.live_demo_request,
        recordingKey: null,
      });

      await assert.rejects(
        () => reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "request_live_demo" }),
        InvalidSignoffTransitionError
      );
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("live_demo_requested (escalated from a recording): pass issues a credential", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.recording,
        recordingKey: "signoff-evidence/a/b/video.mp4",
      });
      await reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "request_live_demo" });

      const updated = await reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "pass" });
      assert.equal(updated.status, "passed");

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.ok(credential);
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("live_demo_requested: request_live_demo again is rejected", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.recording,
        recordingKey: "signoff-evidence/a/b/video.mp4",
      });
      await reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "request_live_demo" });

      await assert.rejects(
        () => reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "request_live_demo" }),
        InvalidSignoffTransitionError
      );
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("a terminal (passed) request rejects any further review", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const request = await submitSignoffRequest({
        userId: user.id,
        certificateId: certificate.id,
        submissionType: SignoffSubmissionType.live_demo_request,
        recordingKey: null,
      });
      await reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "pass" });

      await assert.rejects(
        () => reviewSignoffRequest({ requestId: request.id, reviewerId: user.id, decision: "fail" }),
        InvalidSignoffTransitionError
      );
    } finally {
      await cleanup(user.id, certificate.id);
    }
  });

  test("reviewing a nonexistent request rejects cleanly", async () => {
    await assert.rejects(
      () => reviewSignoffRequest({ requestId: BigInt(999999999), reviewerId: "someone", decision: "pass" }),
      SignoffRequestNotFoundError
    );
  });
});
