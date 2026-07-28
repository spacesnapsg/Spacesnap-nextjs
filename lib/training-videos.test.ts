// Coverage for the Video Tutorials backend port (2026-07-20): TrainingVideo
// CRUD (parse, create, supplier/admin-scoped update, admin delete) and the
// viewer-completion derivation used by the public catalog GET. Hits the real
// test DB through Prisma, same convention as lib/training-sessions.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CertificateEarningMethod } from "../app/generated/prisma/client";
import { ApiValidationError } from "./api-errors";
import {
  CertificateNotEligibleForVideoError,
  createTrainingVideo,
  deleteTrainingVideoAsAdmin,
  deriveViewerState,
  parseTrainingVideoFields,
  TrainingVideoNotFoundError,
  TrainingVideoNotOwnedError,
  updateTrainingVideoAsAdmin,
  updateTrainingVideoAsSupplier,
} from "./training-videos";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Training Video Test Co ${Date.now()}-${companyCounter}` },
  });
}

async function cleanupCompany(companyId: bigint) {
  await prisma.trainingVideo.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

function createCertificate(earningMethod: CertificateEarningMethod) {
  return prisma.certificate.create({
    data: { name: "Test Video Certificate", earningMethod, status: "approved" },
  });
}

// Base fields shared by every test — certificateId is added per-test from a
// real (test-DB) Certificate row, since createTrainingVideo validates it
// against the DB (must exist, be approved, and be tier1_video_quiz — see
// assertCertificateEligibleForVideo).
const VALID_FIELDS = {
  title: "BSL-2 Lab Safety Basics",
  category: "Safety",
  description: "Covers containment and PPE.",
  durationSeconds: 504,
  thumbnailUrl: "https://example.com/thumb.jpg",
  videoUrl: "https://example.com/video.mp4",
};

describe("parseTrainingVideoFields", () => {
  test("accepts a fully-populated valid body (non-partial)", () => {
    const fields = parseTrainingVideoFields({ ...VALID_FIELDS, certificateId: "1" }, { partial: false });
    assert.equal(fields.title, VALID_FIELDS.title);
    assert.equal(fields.category, VALID_FIELDS.category);
    assert.equal(fields.certificateId, BigInt(1));
    assert.equal(fields.durationSeconds, 504);
  });

  test("rejects a missing title/category/certificateId on create", () => {
    try {
      parseTrainingVideoFields({}, { partial: false });
      assert.fail("expected ApiValidationError");
    } catch (error) {
      assert.ok(error instanceof ApiValidationError);
      assert.ok(error.errors.title);
      assert.ok(error.errors.category);
      assert.ok(error.errors.certificateId);
    }
  });

  test("partial mode allows an empty body (nothing to change)", () => {
    const fields = parseTrainingVideoFields({}, { partial: true });
    assert.deepEqual(fields, {});
  });

  test("partial mode still validates a field if it's present", () => {
    assert.throws(() => parseTrainingVideoFields({ title: "" }, { partial: true }), ApiValidationError);
    assert.throws(() => parseTrainingVideoFields({ certificateId: "not-an-id" }, { partial: true }), ApiValidationError);
  });

  test("rejects a negative durationSeconds", () => {
    assert.throws(
      () => parseTrainingVideoFields({ ...VALID_FIELDS, certificateId: "1", durationSeconds: -5 }, { partial: false }),
      ApiValidationError
    );
  });
});

describe("createTrainingVideo / updateTrainingVideoAsSupplier / updateTrainingVideoAsAdmin", () => {
  test("supplier can update their own video", async () => {
    const company = await createCompany();
    const certificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    try {
      const video = await createTrainingVideo({ ...VALID_FIELDS, certificateId: certificate.id }, company.id);
      const updated = await updateTrainingVideoAsSupplier(video.id, company.id, { title: "New Title" });
      assert.equal(updated.title, "New Title");
    } finally {
      await cleanupCompany(company.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
    }
  });

  test("supplier cannot update another company's video", async () => {
    const companyA = await createCompany();
    const companyB = await createCompany();
    const certificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    try {
      const video = await createTrainingVideo({ ...VALID_FIELDS, certificateId: certificate.id }, companyB.id);
      await assert.rejects(
        () => updateTrainingVideoAsSupplier(video.id, companyA.id, { title: "Hijacked" }),
        TrainingVideoNotOwnedError
      );
    } finally {
      await cleanupCompany(companyA.id);
      await cleanupCompany(companyB.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
    }
  });

  test("supplier cannot update a platform-authored video", async () => {
    const company = await createCompany();
    const certificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    const platformVideo = await createTrainingVideo({ ...VALID_FIELDS, certificateId: certificate.id }, null);
    try {
      await assert.rejects(
        () => updateTrainingVideoAsSupplier(platformVideo.id, company.id, { title: "Hijacked" }),
        TrainingVideoNotOwnedError
      );
    } finally {
      await prisma.trainingVideo.delete({ where: { id: platformVideo.id } });
      await cleanupCompany(company.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
    }
  });

  test("supplier update on a nonexistent video rejects with TrainingVideoNotFoundError", async () => {
    const company = await createCompany();
    try {
      await assert.rejects(
        () => updateTrainingVideoAsSupplier(BigInt(999999999), company.id, { title: "X" }),
        TrainingVideoNotFoundError
      );
    } finally {
      await cleanupCompany(company.id);
    }
  });

  test("admin can update any video regardless of company", async () => {
    const company = await createCompany();
    const certificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    try {
      const video = await createTrainingVideo({ ...VALID_FIELDS, certificateId: certificate.id }, company.id);
      const updated = await updateTrainingVideoAsAdmin(video.id, { title: "Admin Edit" });
      assert.equal(updated.title, "Admin Edit");
    } finally {
      await cleanupCompany(company.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
    }
  });

  test("rejects creating a video against a certificate not earned via tier1_video_quiz", async () => {
    const company = await createCompany();
    const certificate = await createCertificate(CertificateEarningMethod.tier2b_operator_or_sme_signoff);
    try {
      await assert.rejects(
        () => createTrainingVideo({ ...VALID_FIELDS, certificateId: certificate.id }, company.id),
        CertificateNotEligibleForVideoError
      );
      const videos = await prisma.trainingVideo.findMany({ where: { companyId: company.id } });
      assert.equal(videos.length, 0, "nothing should be written when the certificate is ineligible");
    } finally {
      await cleanupCompany(company.id);
      await prisma.certificate.delete({ where: { id: certificate.id } });
    }
  });

  test("rejects creating a video against a certificateId that doesn't exist", async () => {
    const company = await createCompany();
    try {
      await assert.rejects(
        () => createTrainingVideo({ ...VALID_FIELDS, certificateId: BigInt(999999999) }, company.id),
        ApiValidationError
      );
    } finally {
      await cleanupCompany(company.id);
    }
  });

  test("rejects re-pointing an existing video at an ineligible certificate on update", async () => {
    const company = await createCompany();
    const goodCertificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    const badCertificate = await createCertificate(CertificateEarningMethod.tier2a_operator_signoff);
    try {
      const video = await createTrainingVideo({ ...VALID_FIELDS, certificateId: goodCertificate.id }, company.id);
      await assert.rejects(
        () => updateTrainingVideoAsSupplier(video.id, company.id, { certificateId: badCertificate.id }),
        CertificateNotEligibleForVideoError
      );
    } finally {
      await cleanupCompany(company.id);
      await prisma.certificate.delete({ where: { id: goodCertificate.id } });
      await prisma.certificate.delete({ where: { id: badCertificate.id } });
    }
  });
});

describe("deleteTrainingVideoAsAdmin", () => {
  test("deletes an existing video", async () => {
    const certificate = await createCertificate(CertificateEarningMethod.tier1_video_quiz);
    const video = await createTrainingVideo({ ...VALID_FIELDS, certificateId: certificate.id }, null);
    await deleteTrainingVideoAsAdmin(video.id);
    const found = await prisma.trainingVideo.findUnique({ where: { id: video.id } });
    assert.equal(found, null);
    await prisma.certificate.delete({ where: { id: certificate.id } });
  });

  test("rejects deleting a nonexistent video", async () => {
    await assert.rejects(() => deleteTrainingVideoAsAdmin(BigInt(999999999)), TrainingVideoNotFoundError);
  });
});

describe("deriveViewerState", () => {
  test("a quiz-backed video is completed only via a passing attempt, not VideoCompletion", () => {
    const passed = deriveViewerState(true, [], { id: BigInt(1), passed: true } as never);
    assert.equal(passed.completedByMe, true);

    const failed = deriveViewerState(true, [], { id: BigInt(1), passed: false } as never);
    assert.equal(failed.completedByMe, false);

    const none = deriveViewerState(true, [{ userId: "u1" }], null);
    assert.equal(none.completedByMe, false, "a VideoCompletion row shouldn't count for a quiz-backed video");
  });

  test("an informational video (no quiz) is completed purely via VideoCompletion", () => {
    const watched = deriveViewerState(false, [{ userId: "u1" }], null);
    assert.equal(watched.completedByMe, true);

    const notWatched = deriveViewerState(false, [], null);
    assert.equal(notWatched.completedByMe, false);
  });
});
