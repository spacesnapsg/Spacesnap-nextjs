import { ActivityActionType, type QuizAttempt } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { issueCredential } from "@/lib/training-credentials";

export function serializeQuizAttempt(attempt: QuizAttempt) {
  return {
    id: attempt.id.toString(),
    userId: attempt.userId,
    trainingVideoId: attempt.trainingVideoId.toString(),
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    passed: attempt.passed,
    createdAt: attempt.createdAt.toISOString(),
  };
}

interface ParsedQuizSubmission {
  // questionId -> answerId, both as bigint. A Map (not a plain object) so a
  // malicious/malformed questionId string can't collide with Object
  // prototype keys.
  answersByQuestionId: Map<bigint, bigint>;
}

function parseBigIntField(value: unknown): bigint | null {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

// Expects { answers: [{ questionId, answerId }, ...] } — one entry per
// question, matching QuizBuilderStep's own "every question needs an answer"
// authoring rule (components/QuizBuilderStep.tsx). Completeness against the
// video's actual current question set is checked separately in
// gradeAndSubmitQuizAttempt, since that requires a DB read this function
// deliberately avoids (kept pure/synchronous like the rest of this app's
// parseXFields helpers).
export function parseQuizSubmission(body: unknown): ParsedQuizSubmission {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const answersByQuestionId = new Map<bigint, bigint>();
  if (!Array.isArray(b.answers) || b.answers.length === 0) {
    errors.answers = ["answers is required and must be a non-empty array."];
  } else {
    for (const [index, entry] of b.answers.entries()) {
      const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const questionId = parseBigIntField(e.questionId);
      const answerId = parseBigIntField(e.answerId);
      if (questionId === null || answerId === null) {
        errors.answers = [`answers[${index}] must have a valid questionId and answerId.`];
        break;
      }
      answersByQuestionId.set(questionId, answerId);
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { answersByQuestionId };
}

export class TrainingVideoNotFoundError extends Error {
  constructor() {
    super("Training video not found.");
  }
}

// A video with no quiz_questions rows has nothing to grade — distinct from
// an incomplete submission (IncompleteQuizSubmissionError below), which is
// the caller's fault, not a data-setup problem.
export class QuizNotConfiguredError extends Error {
  constructor() {
    super("This training video does not have a quiz configured.");
  }
}

// Mirrors QuizBuilderStep's authoring rule the other direction: a submission
// must answer every question currently on the video, no more, no less.
// Rejected cleanly rather than silently grading unanswered questions as
// wrong, matching this app's "clean 422 over silently-wrong behavior"
// convention (e.g. listings_pricing_matches_type, booking overlap).
export class IncompleteQuizSubmissionError extends Error {
  constructor() {
    super("You must answer every question in the quiz.");
  }
}

interface GradeAndSubmitParams {
  userId: string;
  trainingVideoId: bigint;
  answersByQuestionId: Map<bigint, bigint>;
}

interface GradeAndSubmitResult {
  attempt: QuizAttempt;
  credentialIssued: boolean;
}

// Sprint 4, Item 4 — the tier1_video_quiz earning path: auto-graded, no
// reviewer (confirmed against CertificateEarningMethod's own labels — tier1
// is explicitly "self-serve video + quiz", unlike tier2a/2b's operator/SME
// sign-off, which stays on the existing training_enrollments status flow;
// see lib/training-enrollments.ts). Passing requires every question answered
// correctly — this app has no partial-credit/percentage-threshold concept
// anywhere to base a lower bar on (the old app never built quiz grading at
// all, see CODEBASEAPI_SUMMARY.md §6), so "all correct" is the simplest
// defensible default; flag for product review if a partial-credit threshold
// is wanted later.
export async function gradeAndSubmitQuizAttempt(params: GradeAndSubmitParams): Promise<GradeAndSubmitResult> {
  const video = await prisma.trainingVideo.findUnique({
    where: { id: params.trainingVideoId },
    include: { quizQuestions: { include: { answers: true } } },
  });
  if (!video) throw new TrainingVideoNotFoundError();
  if (video.quizQuestions.length === 0) throw new QuizNotConfiguredError();

  const questionIds = new Set(video.quizQuestions.map((q) => q.id));
  if (
    params.answersByQuestionId.size !== questionIds.size ||
    ![...params.answersByQuestionId.keys()].every((id) => questionIds.has(id))
  ) {
    throw new IncompleteQuizSubmissionError();
  }

  let score = 0;
  for (const question of video.quizQuestions) {
    const submittedAnswerId = params.answersByQuestionId.get(question.id);
    const correctAnswer = question.answers.find((a) => a.isCorrect);
    if (correctAnswer && submittedAnswerId === correctAnswer.id) score += 1;
  }
  const totalQuestions = video.quizQuestions.length;
  const passed = score === totalQuestions;

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.quizAttempt.create({
      data: { userId: params.userId, trainingVideoId: video.id, score, totalQuestions, passed },
    });

    await tx.activityLog.create({
      data: {
        userId: params.userId,
        actionType: ActivityActionType.quiz_attempt_submitted,
        description: `Scored ${score}/${totalQuestions} on the "${video.title}" quiz (${passed ? "passed" : "failed"}).`,
      },
    });

    let credentialIssued = false;
    if (passed && video.certificateId !== null) {
      await issueCredential(tx, {
        userId: params.userId,
        certificateId: video.certificateId,
        description: `Earned via passing the "${video.title}" quiz.`,
      });
      credentialIssued = true;
    }

    return { attempt, credentialIssued };
  });
}
