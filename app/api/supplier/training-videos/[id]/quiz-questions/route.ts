import { NextRequest, NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, forbiddenResponse, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { parseQuizQuestionsSubmission, saveQuizQuestionsAsSupplier, serializeQuizQuestionForOwner } from "@/lib/quiz-questions";
import { TrainingVideoNotFoundError, TrainingVideoNotOwnedError } from "@/lib/training-videos";

// POST: replace-all save of a quiz for the supplier's own video. Mirrors old
// QuizQuestionController::store — deletes every existing question, then
// recreates the full set from the submission (no incremental edit).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const videoId = parseBigIntParam(id);
  if (videoId === null) return notFoundResponse("Training video not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const questions = parseQuizQuestionsSubmission(body);
    const saved = await saveQuizQuestionsAsSupplier(videoId, auth.companyId, questions);
    return NextResponse.json({ quizQuestions: saved.map(serializeQuizQuestionForOwner) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof TrainingVideoNotFoundError) return notFoundResponse(error.message);
    if (error instanceof TrainingVideoNotOwnedError) return forbiddenResponse(error.message);
    throw error;
  }
}
