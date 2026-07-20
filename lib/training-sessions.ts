import {
  TrainingEnrollmentStatus,
  CertificateEarningMethod,
  CertificateStatus,
  ActivityActionType,
  type TrainingSession,
  type Company,
  type Certificate,
  type TrainingEnrollment,
  type User,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

// "Active" = currently holding a slot (counts toward capacity). Waitlisted
// enrollments deliberately don't count here — this is the same list
// enrollUser (lib/training-enrollments.ts) uses to decide enrolled vs.
// waitlisted at creation time, kept in one place so the two can't drift.
export const ACTIVE_ENROLLMENT_STATUSES: readonly TrainingEnrollmentStatus[] = [
  TrainingEnrollmentStatus.enrolled,
  TrainingEnrollmentStatus.awaiting_signoff,
  TrainingEnrollmentStatus.completed,
];

function countActive(enrollments: { status: TrainingEnrollmentStatus }[]): number {
  return enrollments.filter((e) => ACTIVE_ENROLLMENT_STATUSES.includes(e.status)).length;
}

// TrainingSession has no stored status column — "past/full/open" is always
// derived, never a field a supplier can set directly (no cancel-session
// feature exists; the old Laravel backend never had one either).
function deriveSessionStatus(
  session: { sessionDatetime: Date; capacity: number },
  enrolledCount: number
): "past" | "full" | "open" {
  if (session.sessionDatetime.getTime() < Date.now()) return "past";
  if (enrolledCount >= session.capacity) return "full";
  return "open";
}

// Public shape (GET /api/training-sessions): counts only, never the
// participant list or other users' ids — browsing sessions shouldn't double
// as a way to enumerate who's enrolled where. `enrollments` here is a
// minimal `{userId, status}` projection, not the full namelist.
type PublicSessionRow = TrainingSession & {
  company: Company | null;
  certificate: Certificate | null;
  enrollments: { userId: string; status: TrainingEnrollmentStatus }[];
};

export function serializePublicTrainingSession(session: PublicSessionRow, viewerUserId: string | null) {
  const enrolledCount = countActive(session.enrollments);
  const waitlistCount = session.enrollments.filter((e) => e.status === TrainingEnrollmentStatus.waitlisted).length;
  const mine = viewerUserId ? session.enrollments.find((e) => e.userId === viewerUserId) : undefined;

  return {
    id: session.id.toString(),
    title: session.title,
    description: session.description,
    smeName: session.smeName,
    sessionDatetime: session.sessionDatetime.toISOString(),
    location: session.location,
    endorsementName: session.endorsementName,
    capacity: session.capacity,
    enrolledCount,
    waitlistCount,
    derivedStatus: deriveSessionStatus(session, enrolledCount),
    hostCompanyName: session.company?.name ?? null,
    certificateId: session.certificateId ? session.certificateId.toString() : null,
    certificateName: session.certificate?.name ?? null,
    myEnrollmentStatus: mine ? mine.status : null,
  };
}

// Supplier shape (GET /api/supplier/training-sessions): includes the real
// participant namelist (name, email, status) for ViewNamelistModal.
type SupplierSessionRow = TrainingSession & {
  certificate: Certificate | null;
  enrollments: (TrainingEnrollment & { user: Pick<User, "name" | "email"> })[];
};

export function serializeSupplierTrainingSession(session: SupplierSessionRow) {
  const enrolledCount = countActive(session.enrollments);

  return {
    id: session.id.toString(),
    title: session.title,
    description: session.description,
    smeName: session.smeName,
    sessionDatetime: session.sessionDatetime.toISOString(),
    location: session.location,
    endorsementName: session.endorsementName,
    capacity: session.capacity,
    enrolledCount,
    derivedStatus: deriveSessionStatus(session, enrolledCount),
    certificateId: session.certificateId ? session.certificateId.toString() : null,
    certificateName: session.certificate?.name ?? null,
    participants: session.enrollments.map((e) => ({
      enrollmentId: e.id.toString(),
      userName: e.user.name,
      userEmail: e.user.email,
      status: e.status,
    })),
  };
}

interface ParsedCreateSessionFields {
  title: string;
  certificateId: bigint;
  sessionDatetime: Date;
  location: string | null;
  capacity: number;
  smeName: string;
  description: string | null;
  endorsementName: string | null;
}

// Mirrors the actual TrainingSession columns (schema.prisma), not the old
// mock UI's fields: there is no `listingId` on this model (confirmed by
// grep — a session is never tied to a specific listing/equipment record),
// so the mock's "Equipment / Listing" dropdown is dropped in favor of a
// free-text `title`, and `endorsementName` (an existing, previously-unused
// column) fills the role the old spacesnap-web mockup called "endorsement"
// (e.g. "Mass Spec Operator Endorsement" — what the participant walks away
// having earned, distinct from the certificate's own catalog name).
export function parseCreateSessionFields(body: unknown): ParsedCreateSessionFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) errors.title = ["title is required."];

  let certificateId: bigint | null = null;
  const rawCertId = typeof b.certificateId === "number" ? String(b.certificateId) : b.certificateId;
  if (typeof rawCertId !== "string" || !/^\d+$/.test(rawCertId)) {
    errors.certificateId = ["certificateId is required."];
  } else {
    certificateId = BigInt(rawCertId);
  }

  let sessionDatetime: Date | null = null;
  if (typeof b.sessionDatetime !== "string" || b.sessionDatetime.trim() === "") {
    errors.sessionDatetime = ["sessionDatetime is required."];
  } else {
    const parsed = new Date(b.sessionDatetime);
    if (Number.isNaN(parsed.getTime())) {
      errors.sessionDatetime = ["sessionDatetime must be a valid date/time."];
    } else {
      sessionDatetime = parsed;
    }
  }

  const location = typeof b.location === "string" && b.location.trim() ? b.location.trim() : null;

  let capacity: number | null = null;
  if (typeof b.capacity !== "number" || !Number.isInteger(b.capacity) || b.capacity < 1) {
    errors.capacity = ["capacity must be an integer of at least 1."];
  } else {
    capacity = b.capacity;
  }

  const smeName = typeof b.smeName === "string" ? b.smeName.trim() : "";
  if (!smeName) errors.smeName = ["smeName is required."];

  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  const endorsementName =
    typeof b.endorsementName === "string" && b.endorsementName.trim() ? b.endorsementName.trim() : null;

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return {
    title,
    certificateId: certificateId!,
    sessionDatetime: sessionDatetime!,
    location,
    capacity: capacity!,
    smeName,
    description,
    endorsementName,
  };
}

export class CertificateNotEligibleForSessionError extends Error {
  constructor() {
    super(
      "This certificate is not earned via a training session — only certificates with earning method " +
        "tier2b_operator_or_sme_signoff can be attached to a session."
    );
  }
}

interface CreateTrainingSessionParams extends ParsedCreateSessionFields {
  companyId: bigint;
  createdByUserId: string;
}

// Only certificates earned via the tier2b_operator_or_sme_signoff path make
// sense to attach to a session — tier1 is auto-graded (no session involved,
// lib/quiz-attempts.ts) and tier2a is a per-user on-demand review
// (CertificateSignoffRequest, lib/certificate-signoffs.ts), not a scheduled
// multi-participant session. See CLAUDE1.md "Sprint 4, Item 4" for the
// three-path design this mirrors.
export async function createTrainingSession(params: CreateTrainingSessionParams): Promise<TrainingSession> {
  const certificate = await prisma.certificate.findUnique({ where: { id: params.certificateId } });
  if (!certificate || certificate.status !== CertificateStatus.approved) {
    throw new ApiValidationError({ certificateId: ["certificateId does not exist."] });
  }
  if (certificate.earningMethod !== CertificateEarningMethod.tier2b_operator_or_sme_signoff) {
    throw new CertificateNotEligibleForSessionError();
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.trainingSession.create({
      data: {
        companyId: params.companyId,
        certificateId: params.certificateId,
        title: params.title,
        smeName: params.smeName,
        description: params.description,
        sessionDatetime: params.sessionDatetime,
        location: params.location,
        endorsementName: params.endorsementName,
        capacity: params.capacity,
      },
    });

    // Logged under the creating supplier's own userId — ActivityLog.userId
    // is NOT NULL and every existing row represents the affected end-user's
    // own action (the closest precedent, POST /api/certificates, doesn't log
    // at all; this one does, since it's a real state-changing write worth an
    // audit trail, same reasoning as every other create/confirm/decline
    // action in this codebase).
    await tx.activityLog.create({
      data: {
        userId: params.createdByUserId,
        actionType: ActivityActionType.training_session_created,
        description: `Created training session "${session.title}" (capacity ${session.capacity}).`,
      },
    });

    return session;
  });
}
