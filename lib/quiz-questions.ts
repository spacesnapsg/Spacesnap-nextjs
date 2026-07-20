import type { QuizAnswer, QuizQuestion } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { TrainingVideoNotFoundError, TrainingVideoNotOwnedError } from "@/lib/training-videos";

// Matches QuizBuilderStep.tsx's own MIN_QUESTIONS authoring rule and the old
// QuizQuestionController's `min:15` validation.
export const MIN_QUIZ_QUESTIONS = 15;
const OPTIONS_PER_QUESTION = 4;

export interface ParsedQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

// Mirrors QuizQuestionController::saveQuestions' validation: questions is a
// required array of at least MIN_QUIZ_QUESTIONS entries, each with a
// non-empty question string, exactly 4 non-empty options, and a
// correctIndex in [0,3].
export function parseQuizQuestionsSubmission(body: unknown): ParsedQuizQuestion[] {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (!Array.isArray(b.questions) || b.questions.length < MIN_QUIZ_QUESTIONS) {
    errors.questions = [`questions must be an array of at least ${MIN_QUIZ_QUESTIONS} entries.`];
    throw new ApiValidationError(errors);
  }

  const parsed: ParsedQuizQuestion[] = [];
  b.questions.forEach((entry, index) => {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;

    const question = typeof e.question === "string" ? e.question.trim() : "";
    if (!question) {
      errors[`questions.${index}.question`] = ["question is required."];
    }

    const options = Array.isArray(e.options) ? e.options.map((o) => (typeof o === "string" ? o.trim() : "")) : [];
    if (options.length !== OPTIONS_PER_QUESTION || options.some((o) => !o)) {
      errors[`questions.${index}.options`] = [`options must be an array of exactly ${OPTIONS_PER_QUESTION} non-empty strings.`];
    }

    const correctIndex = e.correctIndex;
    if (typeof correctIndex !== "number" || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > OPTIONS_PER_QUESTION - 1) {
      errors[`questions.${index}.correctIndex`] = [`correctIndex must be an integer between 0 and ${OPTIONS_PER_QUESTION - 1}.`];
    }

    parsed.push({ question, options, correctIndex: typeof correctIndex === "number" ? correctIndex : -1 });
  });

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return parsed;
}

type QuestionWithAnswers = QuizQuestion & { answers: QuizAnswer[] };

// Taker-safe: never includes isCorrect, so a user fetching the video detail
// to take the quiz can't read the answer key out of the response.
export function serializeQuizQuestionForTaker(question: QuestionWithAnswers) {
  return {
    id: question.id.toString(),
    question: question.question,
    position: question.position,
    answers: question.answers
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((a) => ({ id: a.id.toString(), text: a.text, position: a.position })),
  };
}

// Owner-facing (the save response, right after a supplier/admin authors a
// quiz): includes isCorrect, matching old QuizQuestionController::
// saveQuestions' unfiltered response — the person who just wrote the answer
// key is allowed to see it echoed back.
export function serializeQuizQuestionForOwner(question: QuestionWithAnswers) {
  return {
    id: question.id.toString(),
    question: question.question,
    position: question.position,
    answers: question.answers
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((a) => ({ id: a.id.toString(), text: a.text, isCorrect: a.isCorrect, position: a.position })),
  };
}

// Replace-all semantics, matching the old QuizQuestionController exactly:
// delete every existing question (cascades to answers) then recreate from
// scratch — a video's quiz has no incremental edit affordance in this app,
// only "author a fresh set and save."
async function saveQuizQuestions(trainingVideoId: bigint, questions: ParsedQuizQuestion[]): Promise<QuestionWithAnswers[]> {
  return prisma.$transaction(async (tx) => {
    await tx.quizQuestion.deleteMany({ where: { trainingVideoId } });

    for (const [position, q] of questions.entries()) {
      const created = await tx.quizQuestion.create({
        data: { trainingVideoId, question: q.question, position },
      });
      await tx.quizAnswer.createMany({
        data: q.options.map((text, index) => ({
          quizQuestionId: created.id,
          text,
          isCorrect: index === q.correctIndex,
          position: index,
        })),
      });
    }

    return tx.quizQuestion.findMany({
      where: { trainingVideoId },
      include: { answers: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
    });
  });
}

export async function saveQuizQuestionsAsSupplier(
  trainingVideoId: bigint,
  companyId: bigint,
  questions: ParsedQuizQuestion[]
): Promise<QuestionWithAnswers[]> {
  const video = await prisma.trainingVideo.findUnique({ where: { id: trainingVideoId } });
  if (!video) throw new TrainingVideoNotFoundError();
  if (video.companyId === null || video.companyId !== companyId) {
    throw new TrainingVideoNotOwnedError();
  }
  return saveQuizQuestions(trainingVideoId, questions);
}

export async function saveQuizQuestionsAsAdmin(
  trainingVideoId: bigint,
  questions: ParsedQuizQuestion[]
): Promise<QuestionWithAnswers[]> {
  const video = await prisma.trainingVideo.findUnique({ where: { id: trainingVideoId } });
  if (!video) throw new TrainingVideoNotFoundError();
  return saveQuizQuestions(trainingVideoId, questions);
}
