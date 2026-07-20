import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFoundResponse, unauthorizedResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";

// POST: mark a video watched for the caller. Mirrors old
// TrainingVideoController::complete (VideoCompletion::updateOrCreate) — for
// the majority of videos, which are purely informational and have no quiz
// (see the TrainingVideo model comment in schema.prisma); quiz-backed videos
// track completion via a passing QuizAttempt instead (POST
// /api/training-videos/[id]/quiz-attempts), not this route.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const videoId = parseBigIntParam(id);
  if (videoId === null) return notFoundResponse("Training video not found.");

  const video = await prisma.trainingVideo.findUnique({ where: { id: videoId } });
  if (!video) return notFoundResponse("Training video not found.");

  const completion = await prisma.videoCompletion.upsert({
    where: { userId_trainingVideoId: { userId: session.user.id, trainingVideoId: videoId } },
    update: { completedAt: new Date() },
    create: { userId: session.user.id, trainingVideoId: videoId, completedAt: new Date() },
  });

  return NextResponse.json({ completedAt: completion.completedAt.toISOString() });
}
