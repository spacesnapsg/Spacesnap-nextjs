import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFoundResponse, unauthorizedResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { deriveViewerState, serializeTrainingVideo } from "@/lib/training-videos";
import { serializeQuizQuestionForTaker } from "@/lib/quiz-questions";

// GET: single video detail, including its quiz questions in taker-safe form
// (no isCorrect) — feeds the quiz-taking UI, which needs question/answer
// ids to build a POST /quiz-attempts submission but must not be able to
// read the answer key out of this response.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const videoId = parseBigIntParam(id);
  if (videoId === null) return notFoundResponse("Training video not found.");

  const video = await prisma.trainingVideo.findUnique({
    where: { id: videoId },
    include: {
      company: true,
      _count: { select: { quizQuestions: true, videoCompletions: true } },
      videoCompletions: { where: { userId: session.user.id } },
      quizAttempts: { where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 1 },
      quizQuestions: { include: { answers: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
    },
  });
  if (!video) return notFoundResponse("Training video not found.");

  return NextResponse.json({
    trainingVideo: serializeTrainingVideo(video, {
      counts: video._count,
      viewer: deriveViewerState(video._count.quizQuestions > 0, video.videoCompletions, video.quizAttempts[0] ?? null),
    }),
    quizQuestions: video.quizQuestions.map(serializeQuizQuestionForTaker),
  });
}
