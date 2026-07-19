import {
  ActivityActionType,
  CertificateEarningMethod,
  SignoffRequestStatus,
  SignoffSubmissionType,
  type CertificateSignoffRequest,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { issueCredential } from "@/lib/training-credentials";

export function serializeSignoffRequest(request: CertificateSignoffRequest) {
  return {
    id: request.id.toString(),
    userId: request.userId,
    certificateId: request.certificateId.toString(),
    submissionType: request.submissionType,
    hasRecording: request.recordingKey !== null,
    status: request.status,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

interface ParsedSignoffSubmission {
  submissionType: SignoffSubmissionType;
  recordingKey: string | null;
}

const SUBMISSION_TYPES = new Set<string>(Object.values(SignoffSubmissionType));

// Expects { submissionType: "recording" | "live_demo_request", recordingKey? }.
// recordingKey is required for `recording` and must have already been
// uploaded to R2 by the caller via the presigned upload-url endpoint — this
// function doesn't touch storage at all (see submitSignoffRequest's own
// comment on why), so it can't verify the object exists; that check happens
// in the route, right before calling submitSignoffRequest.
export function parseSignoffSubmission(body: unknown): ParsedSignoffSubmission {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (typeof b.submissionType !== "string" || !SUBMISSION_TYPES.has(b.submissionType)) {
    errors.submissionType = ["submissionType must be one of recording, live_demo_request."];
  }

  let recordingKey: string | null = null;
  if (b.submissionType === SignoffSubmissionType.recording) {
    if (typeof b.recordingKey !== "string" || !b.recordingKey.trim()) {
      errors.recordingKey = ["recordingKey is required for a recording submission."];
    } else {
      recordingKey = b.recordingKey;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { submissionType: b.submissionType as SignoffSubmissionType, recordingKey };
}

export class SignoffCertificateNotFoundError extends Error {
  constructor() {
    super("Certificate not found.");
  }
}

// Thrown when submitting against a certificate whose earningMethod isn't
// tier2a_operator_signoff — this whole module is that one earning path
// (tier1 is lib/quiz-attempts.ts, tier2b is lib/training-enrollments.ts), so
// submitting here for e.g. a tier1_video_quiz cert is a caller error, not a
// legitimate alternate path.
export class SignoffWrongEarningMethodError extends Error {
  constructor() {
    super("This certificate is not earned via operator sign-off.");
  }
}

// Thrown when a (userId, certificateId) row already exists in a non-terminal
// state (pending or live_demo_requested) — there's exactly one record per
// pair (the @@unique constraint), so a second submission while one is
// already in flight must be rejected rather than silently clobbering it.
export class SignoffRequestInProgressError extends Error {
  constructor() {
    super("You already have a sign-off request in progress for this certificate.");
  }
}

interface SubmitSignoffRequestParams {
  userId: string;
  certificateId: bigint;
  submissionType: SignoffSubmissionType;
  recordingKey: string | null;
}

// Sprint 4, Item 4 — the tier2a_operator_signoff earning path (on-demand,
// per-user; NOT the scheduled-session flow, see the SignoffSubmissionType
// schema comment). One row per (userId, certificateId): a fresh submission
// after a terminal outcome (passed/failed) resets that same row rather than
// creating a new one, per the product owner's explicit "one record per user
// certificate" instruction — this is an upsert, not an append-only log like
// QuizAttempt.
//
// Deliberately takes recordingKey as an already-uploaded string rather than
// touching lib/storage.ts itself: keeping this module DB-only (no R2
// dependency) means it can be unit-tested the same way as every other
// lib/*.ts file in this app (real test DB, no mocking) without needing real
// R2 credentials in the test environment. The route layer is responsible for
// generating the presigned upload URL and confirming the object exists
// before calling this function.
export async function submitSignoffRequest(params: SubmitSignoffRequestParams): Promise<CertificateSignoffRequest> {
  return prisma.$transaction(async (tx) => {
    const certificate = await tx.certificate.findUnique({ where: { id: params.certificateId } });
    if (!certificate) throw new SignoffCertificateNotFoundError();
    if (certificate.earningMethod !== CertificateEarningMethod.tier2a_operator_signoff) {
      throw new SignoffWrongEarningMethodError();
    }

    const existing = await tx.certificateSignoffRequest.findUnique({
      where: { userId_certificateId: { userId: params.userId, certificateId: params.certificateId } },
    });
    if (
      existing &&
      (existing.status === SignoffRequestStatus.pending || existing.status === SignoffRequestStatus.live_demo_requested)
    ) {
      throw new SignoffRequestInProgressError();
    }

    const request = existing
      ? await tx.certificateSignoffRequest.update({
          where: { id: existing.id },
          data: {
            submissionType: params.submissionType,
            recordingKey: params.recordingKey,
            status: SignoffRequestStatus.pending,
            reviewedBy: null,
            reviewedAt: null,
          },
        })
      : await tx.certificateSignoffRequest.create({
          data: {
            userId: params.userId,
            certificateId: params.certificateId,
            submissionType: params.submissionType,
            recordingKey: params.recordingKey,
          },
        });

    await tx.activityLog.create({
      data: {
        userId: params.userId,
        actionType: ActivityActionType.signoff_requested,
        description:
          params.submissionType === SignoffSubmissionType.recording
            ? `Submitted a recording for "${certificate.name}" operator sign-off.`
            : `Requested a live demo for "${certificate.name}" operator sign-off.`,
      },
    });

    return request;
  });
}

export type SignoffDecision = "pass" | "fail" | "request_live_demo";

export class SignoffRequestNotFoundError extends Error {
  constructor() {
    super("Sign-off request not found.");
  }
}

// Enforces the transition table confirmed with the product owner: reviewing
// a `recording` submission can only pass it or escalate to a live demo — an
// operator can never hard-fail someone off a recording alone. A live demo
// (whether requested up front or reached via escalation) has already
// happened by the time it's reviewed, so a direct pass/fail call is valid
// there and `request_live_demo` isn't (there's no "escalate a live demo").
export class InvalidSignoffTransitionError extends Error {
  constructor(
    public readonly decision: SignoffDecision,
    public readonly status: SignoffRequestStatus,
    public readonly submissionType: SignoffSubmissionType
  ) {
    super(`Cannot apply decision "${decision}" to a ${status} request (submissionType: ${submissionType}).`);
  }
}

function allowedDecisions(status: SignoffRequestStatus, submissionType: SignoffSubmissionType): SignoffDecision[] {
  if (status === SignoffRequestStatus.pending && submissionType === SignoffSubmissionType.recording) {
    return ["pass", "request_live_demo"];
  }
  if (status === SignoffRequestStatus.pending && submissionType === SignoffSubmissionType.live_demo_request) {
    return ["pass", "fail"];
  }
  if (status === SignoffRequestStatus.live_demo_requested) {
    return ["pass", "fail"];
  }
  return []; // already passed/failed — terminal, no further review
}

interface ReviewSignoffRequestParams {
  requestId: bigint;
  reviewerId: string;
  decision: SignoffDecision;
}

export async function reviewSignoffRequest(params: ReviewSignoffRequestParams): Promise<CertificateSignoffRequest> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.certificateSignoffRequest.findUnique({
      where: { id: params.requestId },
      include: { certificate: true },
    });
    if (!existing) throw new SignoffRequestNotFoundError();

    if (!allowedDecisions(existing.status, existing.submissionType).includes(params.decision)) {
      throw new InvalidSignoffTransitionError(params.decision, existing.status, existing.submissionType);
    }

    const newStatus =
      params.decision === "pass"
        ? SignoffRequestStatus.passed
        : params.decision === "fail"
          ? SignoffRequestStatus.failed
          : SignoffRequestStatus.live_demo_requested;

    const updated = await tx.certificateSignoffRequest.update({
      where: { id: existing.id },
      data: { status: newStatus, reviewedBy: params.reviewerId, reviewedAt: new Date() },
    });

    const decisionLabel =
      params.decision === "pass" ? "passed" : params.decision === "fail" ? "failed" : "asked for a live demo";
    await tx.activityLog.create({
      data: {
        userId: existing.userId,
        actionType: ActivityActionType.signoff_reviewed,
        description: `Operator sign-off for "${existing.certificate.name}" ${decisionLabel}.`,
      },
    });

    if (params.decision === "pass") {
      await issueCredential(tx, {
        userId: existing.userId,
        certificateId: existing.certificateId,
        description: `Earned via operator sign-off for "${existing.certificate.name}".`,
      });
    }

    return updated;
  });
}
