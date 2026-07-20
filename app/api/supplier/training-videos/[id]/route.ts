import { NextRequest, NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, forbiddenResponse, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  parseTrainingVideoFields,
  serializeTrainingVideo,
  TrainingVideoNotFoundError,
  TrainingVideoNotOwnedError,
  updateTrainingVideoAsSupplier,
} from "@/lib/training-videos";

// PATCH: supplier updates their own training video. Mirrors old
// TrainingVideoController::supplierUpdate (403 on another company's or a
// platform-authored video).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const fields = parseTrainingVideoFields(body, { partial: true });
    const video = await updateTrainingVideoAsSupplier(videoId, auth.companyId, fields);
    return NextResponse.json({ trainingVideo: serializeTrainingVideo(video) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof TrainingVideoNotFoundError) return notFoundResponse(error.message);
    if (error instanceof TrainingVideoNotOwnedError) return forbiddenResponse(error.message);
    throw error;
  }
}
