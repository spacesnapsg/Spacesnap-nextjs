// Coverage for the Video Tutorials quiz-authoring backend (2026-07-20):
// parseQuizQuestionsSubmission's validation and the replace-all save
// semantics (saveQuizQuestionsAsSupplier/AsAdmin), mirroring old
// QuizQuestionController's own test matrix (TrainingVideoQuizTest.php in
// spacesnap-api). Hits the real test DB through Prisma.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { ApiValidationError } from "./api-errors";
import { MIN_QUIZ_QUESTIONS, parseQuizQuestionsSubmission, saveQuizQuestionsAsAdmin, saveQuizQuestionsAsSupplier } from "./quiz-questions";
import { createTrainingVideo, TrainingVideoNotFoundError, TrainingVideoNotOwnedError } from "./training-videos";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let companyCounter = 0;
async function createCompany() {
  companyCounter += 1;
  return prisma.company.create({
    data: { name: `Quiz Question Test Co ${Date.now()}-${companyCounter}` },
  });
}

async function cleanupCompany(companyId: bigint) {
  await prisma.trainingVideo.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

function validQuestions(count = MIN_QUIZ_QUESTIONS) {
  return Array.from({ length: count }, (_, i) => ({
    question: `Question ${i + 1}?`,
    options: ["A", "B", "C", "D"],
    correctIndex: i % 4,
  }));
}

describe("parseQuizQuestionsSubmission", () => {
  test("accepts a valid submission of exactly the minimum question count", () => {
    const parsed = parseQuizQuestionsSubmission({ questions: validQuestions() });
    assert.equal(parsed.length, MIN_QUIZ_QUESTIONS);
  });

  test("rejects fewer than the minimum question count", () => {
    assert.throws(() => parseQuizQuestionsSubmission({ questions: validQuestions(MIN_QUIZ_QUESTIONS - 1) }), ApiValidationError);
  });

  test("rejects a question without exactly 4 options", () => {
    const questions = validQuestions(MIN_QUIZ_QUESTIONS - 1);
    questions.push({ question: "Bad question", options: ["Only one"], correctIndex: 0 });
    assert.throws(() => parseQuizQuestionsSubmission({ questions }), ApiValidationError);
  });

  test("rejects a correctIndex outside 0-3", () => {
    const questions = validQuestions(MIN_QUIZ_QUESTIONS - 1);
    questions.push({ question: "Bad question", options: ["A", "B", "C", "D"], correctIndex: 4 });
    assert.throws(() => parseQuizQuestionsSubmission({ questions }), ApiValidationError);
  });

  test("rejects an empty question string", () => {
    const questions = validQuestions(MIN_QUIZ_QUESTIONS - 1);
    questions.push({ question: "  ", options: ["A", "B", "C", "D"], correctIndex: 0 });
    assert.throws(() => parseQuizQuestionsSubmission({ questions }), ApiValidationError);
  });
});

describe("saveQuizQuestionsAsSupplier / saveQuizQuestionsAsAdmin", () => {
  test("supplier can save a valid quiz for their own video, marking exactly one answer correct per question", async () => {
    const company = await createCompany();
    try {
      const video = await createTrainingVideo({ title: "T", category: "Safety" }, company.id);
      const saved = await saveQuizQuestionsAsSupplier(video.id, company.id, parseQuizQuestionsSubmission({ questions: validQuestions() }));

      assert.equal(saved.length, MIN_QUIZ_QUESTIONS);
      const counted = await prisma.quizQuestion.count({ where: { trainingVideoId: video.id } });
      assert.equal(counted, MIN_QUIZ_QUESTIONS);
      const answerCount = await prisma.quizAnswer.count({ where: { quizQuestion: { trainingVideoId: video.id } } });
      assert.equal(answerCount, MIN_QUIZ_QUESTIONS * 4);

      for (const question of saved) {
        const correctCount = question.answers.filter((a) => a.isCorrect).length;
        assert.equal(correctCount, 1);
      }
    } finally {
      await cleanupCompany(company.id);
    }
  });

  test("supplier cannot save a quiz for another company's video", async () => {
    const companyA = await createCompany();
    const companyB = await createCompany();
    try {
      const video = await createTrainingVideo({ title: "T", category: "Safety" }, companyB.id);
      await assert.rejects(
        () => saveQuizQuestionsAsSupplier(video.id, companyA.id, parseQuizQuestionsSubmission({ questions: validQuestions() })),
        TrainingVideoNotOwnedError
      );
    } finally {
      await cleanupCompany(companyA.id);
      await cleanupCompany(companyB.id);
    }
  });

  test("supplier cannot save a quiz for a platform-authored video", async () => {
    const company = await createCompany();
    const platformVideo = await createTrainingVideo({ title: "T", category: "Safety" }, null);
    try {
      await assert.rejects(
        () => saveQuizQuestionsAsSupplier(platformVideo.id, company.id, parseQuizQuestionsSubmission({ questions: validQuestions() })),
        TrainingVideoNotOwnedError
      );
    } finally {
      await prisma.trainingVideo.delete({ where: { id: platformVideo.id } });
      await cleanupCompany(company.id);
    }
  });

  test("saving a quiz for a nonexistent video rejects with TrainingVideoNotFoundError", async () => {
    const company = await createCompany();
    try {
      await assert.rejects(
        () => saveQuizQuestionsAsSupplier(BigInt(999999999), company.id, parseQuizQuestionsSubmission({ questions: validQuestions() })),
        TrainingVideoNotFoundError
      );
    } finally {
      await cleanupCompany(company.id);
    }
  });

  test("admin can save a quiz for any video", async () => {
    const company = await createCompany();
    try {
      const video = await createTrainingVideo({ title: "T", category: "Safety" }, company.id);
      const saved = await saveQuizQuestionsAsAdmin(video.id, parseQuizQuestionsSubmission({ questions: validQuestions() }));
      assert.equal(saved.length, MIN_QUIZ_QUESTIONS);
    } finally {
      await cleanupCompany(company.id);
    }
  });

  test("resaving a quiz replaces the previous question set entirely", async () => {
    const company = await createCompany();
    try {
      const video = await createTrainingVideo({ title: "T", category: "Safety" }, company.id);
      await saveQuizQuestionsAsSupplier(video.id, company.id, parseQuizQuestionsSubmission({ questions: validQuestions() }));

      const replacement = validQuestions(MIN_QUIZ_QUESTIONS + 1);
      replacement[0].question = "Replaced question 1?";
      await saveQuizQuestionsAsSupplier(video.id, company.id, parseQuizQuestionsSubmission({ questions: replacement }));

      const counted = await prisma.quizQuestion.count({ where: { trainingVideoId: video.id } });
      assert.equal(counted, MIN_QUIZ_QUESTIONS + 1);
      const replaced = await prisma.quizQuestion.findFirst({ where: { trainingVideoId: video.id, question: "Replaced question 1?" } });
      assert.ok(replaced);
    } finally {
      await cleanupCompany(company.id);
    }
  });
});
