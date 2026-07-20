import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  deleteTrainingVideoAsAdmin,
  parseTrainingVideoFields,
  serializeTrainingVideo,
  TrainingVideoNotFoundError,
  updateTrainingVideoAsAdmin,
} from "@/lib/training-videos";

// PATCH: admin updates any training video. Mirrors old
// TrainingVideoController::adminUpdate.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const fields = parseTrainingVideoFields(body, { partial: true });
    const video = await updateTrainingVideoAsAdmin(videoId, fields);
    return NextResponse.json({ trainingVideo: serializeTrainingVideo(video) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof TrainingVideoNotFoundError) return notFoundResponse(error.message);
    throw error;
  }
}

// DELETE: admin-only, matching old routes/api.php (destroy sits under the
// admin/training-videos group; suppliers never had a delete route, even for
// their own uploads).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const videoId = parseBigIntParam(id);
  if (videoId === null) return notFoundResponse("Training video not found.");

  try {
    await deleteTrainingVideoAsAdmin(videoId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof TrainingVideoNotFoundError) return notFoundResponse(error.message);
    throw error;
  }
}
