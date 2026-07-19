// Coverage for Sprint 4, Item 4's tier1_video_quiz earning path: auto-graded
// quiz submission -> QuizAttempt row -> credential issuance on an
// all-correct pass. Hits the real test DB through Prisma (no mocking), same
// convention as lib/training-enrollments.test.ts.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CertificateEarningMethod } from "../app/generated/prisma/client";
import {
  gradeAndSubmitQuizAttempt,
  parseQuizSubmission,
  IncompleteQuizSubmissionError,
  QuizNotConfiguredError,
  TrainingVideoNotFoundError,
} from "./quiz-attempts";
import { ApiValidationError } from "./api-errors";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let userCounter = 0;
async function createUser() {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name: "Quiz Attempt Test User",
      email: `quiz-attempt-test-${Date.now()}-${userCounter}@example.com`,
      password: "x",
    },
  });
}

async function createCertificate(earningMethod: CertificateEarningMethod = CertificateEarningMethod.tier1_video_quiz) {
  return prisma.certificate.create({
    data: { name: "Test Quiz Certificate", earningMethod },
  });
}

// Two questions, each with 4 answers, exactly one correct — mirrors
// QuizBuilderStep's authoring rule (min 4 options, exactly 1 correct).
async function createVideoWithQuiz(certificateId: bigint | null) {
  const video = await prisma.trainingVideo.create({
    data: { title: "Test Training Video", certificateId },
  });

  const questions = [];
  for (let i = 0; i < 2; i++) {
    const question = await prisma.quizQuestion.create({
      data: { trainingVideoId: video.id, question: `Question ${i}`, position: i },
    });
    const answers = await prisma.quizAnswer.createManyAndReturn({
      data: [
        { quizQuestionId: question.id, text: "Correct", isCorrect: true, position: 0 },
        { quizQuestionId: question.id, text: "Wrong A", isCorrect: false, position: 1 },
        { quizQuestionId: question.id, text: "Wrong B", isCorrect: false, position: 2 },
        { quizQuestionId: question.id, text: "Wrong C", isCorrect: false, position: 3 },
      ],
    });
    questions.push({ question, answers });
  }
  return { video, questions };
}

function correctAnswers(questions: Awaited<ReturnType<typeof createVideoWithQuiz>>["questions"]) {
  const map = new Map<bigint, bigint>();
  for (const q of questions) {
    const correct = q.answers.find((a) => a.isCorrect)!;
    map.set(q.question.id, correct.id);
  }
  return map;
}

function wrongAnswers(questions: Awaited<ReturnType<typeof createVideoWithQuiz>>["questions"]) {
  const map = new Map<bigint, bigint>();
  const [first, ...rest] = questions;
  const wrong = first.answers.find((a) => !a.isCorrect)!;
  map.set(first.question.id, wrong.id);
  for (const q of rest) {
    const correct = q.answers.find((a) => a.isCorrect)!;
    map.set(q.question.id, correct.id);
  }
  return map;
}

async function cleanup(params: { userId: string; videoId: bigint; certificateId?: bigint }) {
  await prisma.quizAttempt.deleteMany({ where: { userId: params.userId } });
  await prisma.activityLog.deleteMany({ where: { userId: params.userId } });
  await prisma.userCertificate.deleteMany({ where: { userId: params.userId } });
  await prisma.trainingVideo.delete({ where: { id: params.videoId } }); // cascades quiz_questions/quiz_answers
  await prisma.user.delete({ where: { id: params.userId } });
  if (params.certificateId !== undefined) {
    await prisma.certificate.delete({ where: { id: params.certificateId } });
  }
}

describe("parseQuizSubmission", () => {
  test("rejects a missing/empty answers array", () => {
    assert.throws(() => parseQuizSubmission({}), ApiValidationError);
    assert.throws(() => parseQuizSubmission({ answers: [] }), ApiValidationError);
  });

  test("rejects an entry with a non-numeric questionId/answerId", () => {
    assert.throws(() => parseQuizSubmission({ answers: [{ questionId: "abc", answerId: "1" }] }), ApiValidationError);
  });

  test("accepts a well-formed submission", () => {
    const parsed = parseQuizSubmission({ answers: [{ questionId: "1", answerId: "2" }] });
    assert.equal(parsed.answersByQuestionId.get(BigInt(1)), BigInt(2));
  });
});

describe("gradeAndSubmitQuizAttempt (Sprint 4, Item 4 — tier1_video_quiz)", () => {
  test("all-correct submission passes and issues a credential", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    const { video, questions } = await createVideoWithQuiz(certificate.id);
    try {
      const { attempt, credentialIssued } = await gradeAndSubmitQuizAttempt({
        userId: user.id,
        trainingVideoId: video.id,
        answersByQuestionId: correctAnswers(questions),
      });

      assert.equal(attempt.passed, true);
      assert.equal(attempt.score, 2);
      assert.equal(attempt.totalQuestions, 2);
      assert.equal(credentialIssued, true);

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.ok(credential, "expected a UserCertificate row to be created");

      const log = await prisma.activityLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
      assert.equal(log.length, 2);
      assert.equal(log[0].actionType, "quiz_attempt_submitted");
      assert.equal(log[1].actionType, "credential_issued");
    } finally {
      await cleanup({ userId: user.id, videoId: video.id, certificateId: certificate.id });
    }
  });

  test("a submission with one wrong answer fails and issues no credential", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    const { video, questions } = await createVideoWithQuiz(certificate.id);
    try {
      const { attempt, credentialIssued } = await gradeAndSubmitQuizAttempt({
        userId: user.id,
        trainingVideoId: video.id,
        answersByQuestionId: wrongAnswers(questions),
      });

      assert.equal(attempt.passed, false);
      assert.equal(attempt.score, 1);
      assert.equal(credentialIssued, false);

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.equal(credential, null);
    } finally {
      await cleanup({ userId: user.id, videoId: video.id, certificateId: certificate.id });
    }
  });

  test("a passing video with no linked certificate grades but issues nothing", async () => {
    const user = await createUser();
    const { video, questions } = await createVideoWithQuiz(null);
    try {
      const { attempt, credentialIssued } = await gradeAndSubmitQuizAttempt({
        userId: user.id,
        trainingVideoId: video.id,
        answersByQuestionId: correctAnswers(questions),
      });

      assert.equal(attempt.passed, true);
      assert.equal(credentialIssued, false);
    } finally {
      await cleanup({ userId: user.id, videoId: video.id });
    }
  });

  test("retaking after a fail creates a second attempt row, not an update", async () => {
    const user = await createUser();
    const { video, questions } = await createVideoWithQuiz(null);
    try {
      await gradeAndSubmitQuizAttempt({ userId: user.id, trainingVideoId: video.id, answersByQuestionId: wrongAnswers(questions) });
      await gradeAndSubmitQuizAttempt({ userId: user.id, trainingVideoId: video.id, answersByQuestionId: correctAnswers(questions) });

      const attempts = await prisma.quizAttempt.findMany({ where: { userId: user.id } });
      assert.equal(attempts.length, 2);
      assert.equal(attempts.some((a) => a.passed), true);
      assert.equal(attempts.some((a) => !a.passed), true);
    } finally {
      await cleanup({ userId: user.id, videoId: video.id });
    }
  });

  test("resubmitting after already holding the certificate renews earnedDate", async () => {
    const user = await createUser();
    const certificate = await createCertificate();
    const { video, questions } = await createVideoWithQuiz(certificate.id);
    try {
      await prisma.userCertificate.create({
        data: { userId: user.id, certificateId: certificate.id, earnedDate: new Date("2020-01-01"), expiryDate: new Date("2021-01-01") },
      });

      const { credentialIssued } = await gradeAndSubmitQuizAttempt({
        userId: user.id,
        trainingVideoId: video.id,
        answersByQuestionId: correctAnswers(questions),
      });
      assert.equal(credentialIssued, true);

      const credential = await prisma.userCertificate.findUnique({
        where: { userId_certificateId: { userId: user.id, certificateId: certificate.id } },
      });
      assert.equal(credential!.expiryDate, null);
      assert.ok(credential!.earnedDate.getFullYear() >= 2026);

      const rows = await prisma.userCertificate.findMany({ where: { userId: user.id, certificateId: certificate.id } });
      assert.equal(rows.length, 1, "expected an upsert, not a duplicate row");
    } finally {
      await cleanup({ userId: user.id, videoId: video.id, certificateId: certificate.id });
    }
  });

  test("rejects an incomplete submission (missing a question)", async () => {
    const user = await createUser();
    const { video, questions } = await createVideoWithQuiz(null);
    try {
      const partial = new Map([[questions[0].question.id, questions[0].answers[0].id]]);
      await assert.rejects(
        () => gradeAndSubmitQuizAttempt({ userId: user.id, trainingVideoId: video.id, answersByQuestionId: partial }),
        IncompleteQuizSubmissionError
      );

      const attempts = await prisma.quizAttempt.findMany({ where: { userId: user.id } });
      assert.equal(attempts.length, 0);
    } finally {
      await cleanup({ userId: user.id, videoId: video.id });
    }
  });

  test("rejects a video with no quiz configured", async () => {
    const user = await createUser();
    const video = await prisma.trainingVideo.create({ data: { title: "No Quiz Video" } });
    try {
      await assert.rejects(
        () => gradeAndSubmitQuizAttempt({ userId: user.id, trainingVideoId: video.id, answersByQuestionId: new Map() }),
        QuizNotConfiguredError
      );
    } finally {
      await prisma.trainingVideo.delete({ where: { id: video.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("rejects a nonexistent training video", async () => {
    const user = await createUser();
    try {
      await assert.rejects(
        () => gradeAndSubmitQuizAttempt({ userId: user.id, trainingVideoId: BigInt(999999999), answersByQuestionId: new Map() }),
        TrainingVideoNotFoundError
      );
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
