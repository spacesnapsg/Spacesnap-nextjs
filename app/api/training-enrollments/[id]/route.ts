import { NextRequest, NextResponse } from "next/server";
import { TrainingEnrollmentStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, forbiddenResponse, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  InvalidEnrollmentStatusTransitionError,
  serializeTrainingEnrollment,
  updateEnrollmentStatus,
} from "@/lib/training-enrollments";

const UPDATABLE_STATUSES = new Set<string>(
  Object.values(TrainingEnrollmentStatus).filter((s) => s !== TrainingEnrollmentStatus.enrolled)
);

// PATCH: update an enrollment's status. Restricted to the supplier that owns
// the training session (same company-ownership shape as the booking
// confirm/decline routes) since sign-off/completion is administered by
// whoever ran the session.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const enrollmentId = parseBigIntParam(id);
  if (enrollmentId === null) return notFoundResponse("Training enrollment not found.");

  const enrollment = await prisma.trainingEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { trainingSession: true },
  });
  if (!enrollment) return notFoundResponse("Training enrollment not found.");
  if (enrollment.trainingSession.companyId !== auth.companyId) {
    return forbiddenResponse("You do not have access to this training enrollment.");
  }

  const body = await request.json().catch(() => null);
  const status = (body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined) as unknown;
  if (typeof status !== "string" || !UPDATABLE_STATUSES.has(status)) {
    return validationErrorResponse(
      new ApiValidationError({ status: ["status must be one of awaiting_signoff, completed, cancelled."] })
    );
  }

  try {
    const updated = await updateEnrollmentStatus(enrollmentId, status as TrainingEnrollmentStatus);
    return NextResponse.json({ trainingEnrollment: serializeTrainingEnrollment(updated) });
  } catch (error) {
    if (error instanceof InvalidEnrollmentStatusTransitionError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
