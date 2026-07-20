import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serializePublicTrainingSession } from "@/lib/training-sessions";

// GET: public catalog of training sessions (mirrors old
// TrainingSessionController::index, unauthenticated in routes/api.php).
// Merges the caller's own enrollment status per session when authenticated —
// see serializePublicTrainingSession for why the raw participant list is
// never exposed here (counts only).
export async function GET() {
  const session = await auth();
  const viewerUserId = session?.user?.id ?? null;

  const trainingSessions = await prisma.trainingSession.findMany({
    include: {
      company: true,
      certificate: true,
      enrollments: { select: { userId: true, status: true } },
    },
    orderBy: { sessionDatetime: "asc" },
  });

  return NextResponse.json({
    trainingSessions: trainingSessions.map((s) => serializePublicTrainingSession(s, viewerUserId)),
  });
}
