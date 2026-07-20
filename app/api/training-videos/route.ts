import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";
import { deriveViewerState, serializeTrainingVideo } from "@/lib/training-videos";

// GET: the full training video catalog (platform + every supplier's own
// uploads), mirroring old TrainingVideoController::index — but unlike that
// route (public/unauthenticated in the old backend's routes/api.php), this
// requires a session: every page that reaches this endpoint already sits
// behind this rewrite's route-protection + client RoleGuard, and requiring
// auth here lets the response merge the caller's own completedByMe/
// myLatestQuizAttempt state in one round trip instead of a second request.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const videos = await prisma.trainingVideo.findMany({
    // Case-insensitive: TrainingVideo.category is free-text, and seeded rows
    // use lowercase ("safety") while the upload form's VIDEO_CATEGORIES
    // dropdown submits capitalized values ("Safety") — an exact match would
    // silently hide every seeded video the moment a filter pill is clicked.
    where: category ? { category: { equals: category, mode: "insensitive" } } : undefined,
    include: {
      company: true,
      _count: { select: { quizQuestions: true, videoCompletions: true } },
      videoCompletions: { where: { userId: session.user.id } },
      quizAttempts: { where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    trainingVideos: videos.map((video) =>
      serializeTrainingVideo(video, {
        counts: video._count,
        viewer: deriveViewerState(video._count.quizQuestions > 0, video.videoCompletions, video.quizAttempts[0] ?? null),
      })
    ),
  });
}
