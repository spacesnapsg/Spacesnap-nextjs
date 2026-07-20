import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { parseQuizQuestionsSubmission, saveQuizQuestionsAsAdmin, serializeQuizQuestionForOwner } from "@/lib/quiz-questions";
import { TrainingVideoNotFoundError } from "@/lib/training-videos";

// POST: replace-all save of a quiz for any video. Mirrors old
// QuizQuestionController::adminStore (no ownership check, unlike the
// supplier route).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
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
    const saved = await saveQuizQuestionsAsAdmin(videoId, questions);
    return NextResponse.json({ quizQuestions: saved.map(serializeQuizQuestionForOwner) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof TrainingVideoNotFoundError) return notFoundResponse(error.message);
    throw error;
  }
}
