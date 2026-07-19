import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  ALREADY_ENROLLED_MESSAGE,
  AlreadyEnrolledError,
  enrollUser,
  hasExistingEnrollment,
  parseEnrollFields,
  serializeTrainingEnrollment,
} from "@/lib/training-enrollments";

// POST: enroll the requesting user in a training session. Sprint 3.5 new
// schema item — see the training_enrollments schema comment in schema.prisma
// for the unique-per-(user, session) rule and its DB-constraint fallback.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseEnrollFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: fields.trainingSessionId } });
  if (!trainingSession) {
    return validationErrorResponse(new ApiValidationError({ trainingSessionId: ["trainingSessionId does not exist."] }));
  }

  const alreadyEnrolled = await hasExistingEnrollment(session.user.id, fields.trainingSessionId);
  if (alreadyEnrolled) {
    return NextResponse.json({ message: ALREADY_ENROLLED_MESSAGE }, { status: 409 });
  }

  try {
    const enrollment = await enrollUser({
      userId: session.user.id,
      trainingSessionId: fields.trainingSessionId,
    });
    return NextResponse.json({ trainingEnrollment: serializeTrainingEnrollment(enrollment) }, { status: 201 });
  } catch (error) {
    // Race window between the app-layer check above and this insert: the DB
    // constraint (training_enrollments_user_id_training_session_id_key) is
    // the actual source of truth and enrollUser() re-surfaces it as this same
    // clean error if another request's enrollment landed in between.
    if (error instanceof AlreadyEnrolledError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    throw error;
  }
}
