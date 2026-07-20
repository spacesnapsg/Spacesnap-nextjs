import { TrainingEnrollmentStatus, ActivityActionType, Prisma, type TrainingEnrollment } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { issueCredential } from "@/lib/training-credentials";

export function serializeTrainingEnrollment(enrollment: TrainingEnrollment) {
  return {
    id: enrollment.id.toString(),
    userId: enrollment.userId,
    trainingSessionId: enrollment.trainingSessionId.toString(),
    status: enrollment.status,
    createdAt: enrollment.createdAt.toISOString(),
    updatedAt: enrollment.updatedAt.toISOString(),
  };
}

// Shared with the 23505 catch in app/api/training-enrollments/route.ts so both
// the app-layer pre-check and the DB-constraint race-condition fallback
// surface the identical user-facing message. Mirrors BOOKING_OVERLAP_MESSAGE
// in lib/bookings.ts / the bookings_no_overlap 23P01 idiom.
export const ALREADY_ENROLLED_MESSAGE = "You are already enrolled in this training session.";

export class AlreadyEnrolledError extends Error {
  constructor() {
    super(ALREADY_ENROLLED_MESSAGE);
  }
}

interface ParsedEnrollFields {
  trainingSessionId: bigint;
}

export function parseEnrollFields(body: unknown): ParsedEnrollFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let trainingSessionId: bigint | null = null;
  const raw = typeof b.trainingSessionId === "number" ? String(b.trainingSessionId) : b.trainingSessionId;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    errors.trainingSessionId = ["trainingSessionId is required."];
  } else {
    trainingSessionId = BigInt(raw);
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { trainingSessionId: trainingSessionId! };
}

// App-layer mirror of the training_enrollments_user_id_training_session_id_key
// unique index (prisma/migrations/20260719111214_add_training_enrollments):
// lets the common case return a clean error without ever reaching Postgres's
// 23505. The DB constraint stays as the last line of defense for the race
// between this check and the insert (see route.ts).
export async function hasExistingEnrollment(userId: string, trainingSessionId: bigint): Promise<boolean> {
  const existing = await prisma.trainingEnrollment.findUnique({
    where: { userId_trainingSessionId: { userId, trainingSessionId } },
    select: { id: true },
  });
  return existing !== null;
}

interface EnrollUserParams {
  userId: string;
  trainingSessionId: bigint;
}

// 2026-07-20 product owner decision: enrolling never rejects for being full —
// once active enrollment (enrolled/awaiting_signoff/completed — i.e. anyone
// currently holding a slot) reaches capacity, new enrollments land as
// `waitlisted` instead. A supplier later promotes a waitlisted row to
// `enrolled` via updateEnrollmentStatus below.
//
// Wraps the insert in a try/catch so a P2002 raised by the @@unique index
// (the race-condition case that slips past hasExistingEnrollment's
// pre-check) comes out as the same clean AlreadyEnrolledError as the
// pre-check path, instead of a raw PrismaClientKnownRequestError reaching
// the route. Unlike bookings_no_overlap (an EXCLUDE constraint Prisma can't
// model, so that violation passes through raw via `error.cause.code`),
// `@@unique` is a constraint shape Prisma understands natively, so it's
// translated into its own typed P2002 error instead.
//
// The capacity count is read under a row lock on the training_sessions row
// (raw SQL — Prisma has no lockForUpdate primitive), mirroring the old
// TrainingSessionController::enroll's lockForUpdate(): without it, two
// concurrent enrollments racing this count could both read "under capacity"
// and both land as `enrolled`, overfilling the session.
export async function enrollUser(params: EnrollUserParams): Promise<TrainingEnrollment> {
  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: bigint; capacity: number }[]>`
        SELECT id, capacity FROM training_sessions WHERE id = ${params.trainingSessionId} FOR UPDATE
      `;
      const session = locked[0];
      if (!session) {
        throw new TrainingSessionNotFoundError();
      }

      const activeCount = await tx.trainingEnrollment.count({
        where: {
          trainingSessionId: params.trainingSessionId,
          status: {
            in: [
              TrainingEnrollmentStatus.enrolled,
              TrainingEnrollmentStatus.awaiting_signoff,
              TrainingEnrollmentStatus.completed,
            ],
          },
        },
      });

      const isFull = activeCount >= session.capacity;
      const status = isFull ? TrainingEnrollmentStatus.waitlisted : TrainingEnrollmentStatus.enrolled;

      const enrollment = await tx.trainingEnrollment.create({
        data: {
          userId: params.userId,
          trainingSessionId: params.trainingSessionId,
          status,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: params.userId,
          actionType: isFull ? ActivityActionType.training_waitlisted : ActivityActionType.training_enrolled,
          description: isFull
            ? `Waitlisted for training session #${params.trainingSessionId} (session at capacity).`
            : `Enrolled in training session #${params.trainingSessionId}.`,
        },
      });

      return enrollment;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AlreadyEnrolledError();
    }
    throw error;
  }
}

export class TrainingSessionNotFoundError extends Error {
  constructor() {
    super("Training session not found.");
  }
}

// Thrown from updateEnrollmentStatus for an unsupported target status:
// "waitlisted" is only ever set by enrollUser at creation time based on
// capacity, never via a status update; "enrolled" is reachable only as a
// promotion from an existing "waitlisted" row (the supplier "Approve"
// action) — every other attempt to set "enrolled" (from awaiting_signoff,
// completed, cancelled, or a fresh row) is rejected, since those have no
// supported path back to it.
export class InvalidEnrollmentStatusTransitionError extends Error {
  constructor(
    public readonly status: TrainingEnrollmentStatus,
    public readonly fromStatus?: TrainingEnrollmentStatus
  ) {
    super(
      status === TrainingEnrollmentStatus.enrolled
        ? `Cannot set enrollment status to enrolled from ${fromStatus ?? "its current status"} — only a waitlisted enrollment can be approved into enrolled.`
        : `Cannot set enrollment status to ${status}.`
    );
  }
}

// Sprint 4, Item 4 — the tier2a/2b operator-or-SME-sign-off earning path.
// Reuses training_enrollments' existing status column rather than a new
// pass/fail concept, per this item's explicit "don't invent new statuses"
// instruction: `completed` is the pass outcome (issues a credential),
// `cancelled` is the fail/no-credential outcome. There's no separate
// "failed" status — `cancelled` already meant "this enrollment didn't result
// in a credential" before this item, whether from a supplier rejecting the
// sign-off or the enrollee withdrawing; both cases correctly issue nothing.
// Credential issuance only fires on a genuine enrolled/awaiting_signoff ->
// completed transition, not on every call that happens to pass `completed`
// (see below), so re-PATCHing an already-completed enrollment can't
// re-fire the activity log entry.
export async function updateEnrollmentStatus(
  enrollmentId: bigint,
  status: TrainingEnrollmentStatus
): Promise<TrainingEnrollment> {
  if (status === TrainingEnrollmentStatus.waitlisted) {
    throw new InvalidEnrollmentStatusTransitionError(status);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.trainingEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: { trainingSession: true },
    });

    if (status === TrainingEnrollmentStatus.enrolled && existing.status !== TrainingEnrollmentStatus.waitlisted) {
      throw new InvalidEnrollmentStatusTransitionError(status, existing.status);
    }

    const updated = await tx.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: { status },
    });

    if (status === TrainingEnrollmentStatus.enrolled) {
      await tx.activityLog.create({
        data: {
          userId: existing.userId,
          actionType: ActivityActionType.training_waitlist_approved,
          description: `Approved off the waitlist into training session #${existing.trainingSessionId}.`,
        },
      });
    }

    const isNewlyCompleted = status === TrainingEnrollmentStatus.completed && existing.status !== status;
    if (isNewlyCompleted && existing.trainingSession.certificateId !== null) {
      await issueCredential(tx, {
        userId: existing.userId,
        certificateId: existing.trainingSession.certificateId,
        description: `Earned via completing "${existing.trainingSession.title}" (sign-off).`,
      });
    }

    return updated;
  });
}
