import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  gradeAndSubmitQuizAttempt,
  IncompleteQuizSubmissionError,
  parseQuizSubmission,
  QuizNotConfiguredError,
  serializeQuizAttempt,
  TrainingVideoNotFoundError,
} from "@/lib/quiz-attempts";

// GET: the caller's own attempt history on this video — so a failed attempt's
// score/result stays visible after the initial POST response (e.g. after a
// page refresh), same "no GET to list a user's own X" gap-closing idiom as
// GET /api/bookings.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const trainingVideoId = parseBigIntParam(id);
  if (trainingVideoId === null) return notFoundResponse("Training video not found.");

  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: session.user.id, trainingVideoId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ quizAttempts: attempts.map(serializeQuizAttempt) });
}

// POST: submit a quiz attempt for auto-grading (Sprint 4, Item 4 — the
// tier1_video_quiz earning path). No reviewer: grading and, on an
// all-correct pass, credential issuance both happen synchronously inside
// gradeAndSubmitQuizAttempt (lib/quiz-attempts.ts), so the response already
// carries the final result.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const trainingVideoId = parseBigIntParam(id);
  if (trainingVideoId === null) return notFoundResponse("Training video not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseQuizSubmission(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    const { attempt, credentialIssued } = await gradeAndSubmitQuizAttempt({
      userId: session.user.id,
      trainingVideoId,
      answersByQuestionId: fields.answersByQuestionId,
    });
    return NextResponse.json({ quizAttempt: serializeQuizAttempt(attempt), credentialIssued }, { status: 201 });
  } catch (error) {
    if (error instanceof TrainingVideoNotFoundError) return notFoundResponse(error.message);
    if (error instanceof QuizNotConfiguredError || error instanceof IncompleteQuizSubmissionError) {
      return validationErrorResponse(new ApiValidationError({ answers: [error.message] }));
    }
    throw error;
  }
}
