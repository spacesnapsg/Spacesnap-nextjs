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

function createTrainingSession(companyId: bigint) {
  return prisma.trainingSession.create({
    data: {
      companyId,
      title: "Test Training Session",
      smeName: "Test SME",
      sessionDatetime: new Date("2027-12-01T09:00:00Z"),
      capacity: 10,
    },
  });
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
