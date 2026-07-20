import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { createTrainingVideo, parseTrainingVideoFields, serializeTrainingVideo } from "@/lib/training-videos";

// GET: admin catalog view, optional ?category= filter. Mirrors old
// TrainingVideoController::adminIndex (latest-first).
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const videos = await prisma.trainingVideo.findMany({
    // Case-insensitive — see the matching comment in
    // app/api/training-videos/route.ts for why (seed data vs. form casing).
    where: category ? { category: { equals: category, mode: "insensitive" } } : undefined,
    include: { company: true, _count: { select: { quizQuestions: true, videoCompletions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    trainingVideos: videos.map((video) => serializeTrainingVideo(video, { counts: video._count })),
  });
}

// POST: admin creates a platform-authored video (companyId null). Mirrors
// old TrainingVideoController::adminStore.
export async function POST(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseTrainingVideoFields(body, { partial: false });
    const video = await createTrainingVideo({ title: fields.title!, category: fields.category!, ...fields }, null);
    return NextResponse.json({ trainingVideo: serializeTrainingVideo(video) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
