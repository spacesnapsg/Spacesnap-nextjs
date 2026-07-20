import { NextRequest, NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { createTrainingVideo, parseTrainingVideoFields, serializeTrainingVideo } from "@/lib/training-videos";

// POST: supplier uploads a video scoped to their own company. Mirrors old
// TrainingVideoController::supplierStore (403 if the caller has no company —
// already enforced by requireSupplier()).
export async function POST(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseTrainingVideoFields(body, { partial: false });
    const video = await createTrainingVideo(
      { title: fields.title!, category: fields.category!, ...fields },
      auth.companyId
    );
    return NextResponse.json({ trainingVideo: serializeTrainingVideo(video) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
