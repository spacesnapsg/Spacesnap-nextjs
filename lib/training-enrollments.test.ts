// Coverage for the Sprint 3.5 new schema item: training_enrollments table +
// enroll/status-update write paths, including the DB-level unique constraint
// on (user_id, training_session_id) producing a clean AlreadyEnrolledError
// rather than a raw Prisma/Postgres exception. Hits the real test DB through
// Prisma (no mocking), same convention as lib/check-ins.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TrainingEnrollmentStatus } from "../app/generated/prisma/client";
import {
  enrollUser,
  hasExistingEnrollment,
  updateEnrollmentStatus,
  AlreadyEnrolledError,
  InvalidEnrollmentStatusTransitionError,
} from "./training-enrollments";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Training Enrollment Test Co ${Date.now()}-${companyCounter}` },
  });
}

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Training Enrollment Test User",
      email: `training-enrollment-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

function createTrainingSession(companyId: bigint, certificateId?: bigint, capacity = 10) {
  return prisma.trainingSession.create({
    data: {
      companyId,
      certificateId,
      title: "Test Training Session",
      smeName: "Test SME",
      sessionDatetime: new Date("2027-12-01T09:00:00Z"),
      capacity,
    },
  });
}

function createCertificate() {
  return prisma.certificate.create({ data: { name: "Test Enrollment Certificate" } });
}

async function cleanupCompanyAndUsers(companyId: bigint, userIds: string[]) {
  await prisma.company.delete({ where: { id: companyId } });
  for (const userId of userIds) {
    await prisma.user.delete({ where: { id: userId } });
  }
}

describe("enrollUser (Sprint 3.5, training_enrollments new schema item)", () => {
  test("enrolling creates a row with status enrolled", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id);

      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      assert.equal(enrollment.userId, user.id);
      assert.equal(enrollment.trainingSessionId, trainingSession.id);
      assert.equal(enrollment.status, TrainingEnrollmentStatus.enrolled);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("enrolling the same user in the same session twice rejects cleanly (unique constraint, not a raw DB exception)", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id);

      await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      await assert.rejects(
        () => enrollUser({ userId: user.id, trainingSessionId: trainingSession.id }),
        AlreadyEnrolledError
      );

      const enrollments = await prisma.trainingEnrollment.findMany({
        where: { userId: user.id, trainingSessionId: trainingSession.id },
      });
      assert.equal(enrollments.length, 1);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("the same user can enroll in two different sessions", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const sessionA = await createTrainingSession(company.id);
      const sessionB = await createTrainingSession(company.id);

      await enrollUser({ userId: user.id, trainingSessionId: sessionA.id });
      await enrollUser({ userId: user.id, trainingSessionId: sessionB.id });

      const enrollments = await prisma.trainingEnrollment.findMany({ where: { userId: user.id } });
      assert.equal(enrollments.length, 2);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("hasExistingEnrollment (Sprint 3.5, training_enrollments new schema item)", () => {
  test("returns false before enrolling and true after", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id);

      assert.equal(await hasExistingEnrollment(user.id, trainingSession.id), false);

      await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      assert.equal(await hasExistingEnrollment(user.id, trainingSession.id), true);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

describe("updateEnrollmentStatus (Sprint 3.5, training_enrollments new schema item)", () => {
  test("moves an enrollment from enrolled to awaiting_signoff to completed", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      const awaiting = await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.awaiting_signoff);
      assert.equal(awaiting.status, TrainingEnrollmentStatus.awaiting_signoff);

      const completed = await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.completed);
      assert.equal(completed.status, TrainingEnrollmentStatus.completed);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cancels an enrollment", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      const cancelled = await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.cancelled);
      assert.equal(cancelled.status, TrainingEnrollmentStatus.cancelled);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("rejects setting status back to enrolled", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });
      await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.awaiting_signoff);

      await assert.rejects(
        () => updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.enrolled),
        InvalidEnrollmentStatusTransitionError
      );

      const row = await prisma.trainingEnrollment.findUnique({ where: { id: enrollment.id } });
      assert.equal(row!.status, TrainingEnrollmentStatus.awaiting_signoff);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// Sprint 4, Item 4 — the tier2a/2b operator-or-SME-sign-off earning path.
// completed = pass (issues a credential), cancelled = fail (issues nothing)
// — reusing the existing status enum, no new values added.
describe("updateEnrollmentStatus credential issuance (Sprint 4, Item 4)", () => {
  test("completing an enrollment for a certificate-linked session issues a credential", async () => {
    const company = await createCompany();
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const trainingSession = await createTrainingSession(company.id, certificate.id);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.completed);

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.ok(credential, "expected a UserCertificate row to be created");

      const log = await prisma.activityLog.findMany({ where: { userId: user.id, actionType: "credential_issued" } });
      assert.equal(log.length, 1);
    } finally {
      await prisma.activityLog.deleteMany({ where: { userId: user.id } });
      await prisma.userCertificate.deleteMany({ where: { userId: user.id } });
      await prisma.trainingSession.deleteMany({ where: { companyId: company.id } });
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("cancelling an enrollment issues no credential", async () => {
    const company = await createCompany();
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const trainingSession = await createTrainingSession(company.id, certificate.id);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.cancelled);

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.equal(credential, null);
    } finally {
      await prisma.trainingSession.deleteMany({ where: { companyId: company.id } });
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("completing an enrollment for a session with no linked certificate issues nothing", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      const updated = await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.completed);
      assert.equal(updated.status, TrainingEnrollmentStatus.completed);

      const credentials = await prisma.userCertificate.findMany({ where: { userId: user.id } });
      assert.equal(credentials.length, 0);
    } finally {
      await prisma.trainingSession.deleteMany({ where: { companyId: company.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("re-PATCHing an already-completed enrollment to completed does not re-issue a duplicate credential", async () => {
    const company = await createCompany();
    const user = await createUser();
    const certificate = await createCertificate();
    try {
      const trainingSession = await createTrainingSession(company.id, certificate.id);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.completed);
      await updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.completed);

      const credentials = await prisma.userCertificate.findMany({
        where: { userId: user.id, certificateId: certificate.id },
      });
      assert.equal(credentials.length, 1);

      const log = await prisma.activityLog.findMany({ where: { userId: user.id, actionType: "credential_issued" } });
      assert.equal(log.length, 1, "credential_issued should only log once, not on every completed PATCH");
    } finally {
      await prisma.activityLog.deleteMany({ where: { userId: user.id } });
      await prisma.userCertificate.deleteMany({ where: { userId: user.id } });
      await prisma.trainingSession.deleteMany({ where: { companyId: company.id } });
      await prisma.certificate.delete({ where: { id: certificate.id } });
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});

// 2026-07-20 product owner decision: enrolling never rejects for being full
// — it waitlists instead, and only a supplier PATCH can promote a waitlisted
// row to enrolled.
describe("enrollUser capacity / waitlist (2026-07-20 product owner decision)", () => {
  test("enrolling past capacity waitlists instead of rejecting", async () => {
    const company = await createCompany();
    const userA = await createUser();
    const userB = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id, undefined, 1);

      const enrollmentA = await enrollUser({ userId: userA.id, trainingSessionId: trainingSession.id });
      assert.equal(enrollmentA.status, TrainingEnrollmentStatus.enrolled);

      const enrollmentB = await enrollUser({ userId: userB.id, trainingSessionId: trainingSession.id });
      assert.equal(enrollmentB.status, TrainingEnrollmentStatus.waitlisted);
    } finally {
      await cleanupCompanyAndUsers(company.id, [userA.id, userB.id]);
    }
  });

  test("awaiting_signoff counts toward capacity; cancelled frees it up for the next enrollment", async () => {
    const company = await createCompany();
    const userA = await createUser();
    const userB = await createUser();
    const userC = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id, undefined, 1);

      const enrollmentA = await enrollUser({ userId: userA.id, trainingSessionId: trainingSession.id });
      await updateEnrollmentStatus(enrollmentA.id, TrainingEnrollmentStatus.awaiting_signoff);

      const enrollmentB = await enrollUser({ userId: userB.id, trainingSessionId: trainingSession.id });
      assert.equal(enrollmentB.status, TrainingEnrollmentStatus.waitlisted, "A is awaiting_signoff, still holds the slot");

      await updateEnrollmentStatus(enrollmentA.id, TrainingEnrollmentStatus.cancelled);

      const enrollmentC = await enrollUser({ userId: userC.id, trainingSessionId: trainingSession.id });
      assert.equal(
        enrollmentC.status,
        TrainingEnrollmentStatus.enrolled,
        "cancelling A freed the slot; B stays waitlisted since promotion is a manual supplier action, not automatic"
      );

      const bRow = await prisma.trainingEnrollment.findUnique({ where: { id: enrollmentB.id } });
      assert.equal(bRow!.status, TrainingEnrollmentStatus.waitlisted);
    } finally {
      await cleanupCompanyAndUsers(company.id, [userA.id, userB.id, userC.id]);
    }
  });

  test("a supplier can promote a waitlisted enrollment to enrolled", async () => {
    const company = await createCompany();
    const userA = await createUser();
    const userB = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id, undefined, 1);

      await enrollUser({ userId: userA.id, trainingSessionId: trainingSession.id });
      const enrollmentB = await enrollUser({ userId: userB.id, trainingSessionId: trainingSession.id });
      assert.equal(enrollmentB.status, TrainingEnrollmentStatus.waitlisted);

      const promoted = await updateEnrollmentStatus(enrollmentB.id, TrainingEnrollmentStatus.enrolled);
      assert.equal(promoted.status, TrainingEnrollmentStatus.enrolled);
    } finally {
      await cleanupCompanyAndUsers(company.id, [userA.id, userB.id]);
    }
  });

  test("promoting to enrolled from any status other than waitlisted is rejected", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id, undefined, 10);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });
      assert.equal(enrollment.status, TrainingEnrollmentStatus.enrolled);

      await assert.rejects(
        () => updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.enrolled),
        InvalidEnrollmentStatusTransitionError
      );
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });

  test("setting status to waitlisted directly via updateEnrollmentStatus is rejected", async () => {
    const company = await createCompany();
    const user = await createUser();
    try {
      const trainingSession = await createTrainingSession(company.id, undefined, 10);
      const enrollment = await enrollUser({ userId: user.id, trainingSessionId: trainingSession.id });

      await assert.rejects(
        () => updateEnrollmentStatus(enrollment.id, TrainingEnrollmentStatus.waitlisted),
        InvalidEnrollmentStatusTransitionError
      );

      const row = await prisma.trainingEnrollment.findUnique({ where: { id: enrollment.id } });
      assert.equal(row!.status, TrainingEnrollmentStatus.enrolled);
    } finally {
      await cleanupCompanyAndUsers(company.id, [user.id]);
    }
  });
});
