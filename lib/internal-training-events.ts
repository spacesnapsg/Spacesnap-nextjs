import {
  ActivityActionType,
  CredentialProvenance,
  InternalTrainingEventStatus,
  InternalTrainingParticipantStatus,
  type InternalTrainingEvent,
  type InternalTrainingParticipant,
  type Prisma,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { issueCredential } from "@/lib/training-credentials";

// The tier2a1_internal_company_signoff earning path's batch parent/child
// pair — see the schema comments on InternalTrainingEvent/
// InternalTrainingParticipant. This module owns every business rule the
// brief specified; the route layer only handles auth + (de)serialization +
// storage existence checks (same DB-only split as lib/certificate-signoffs.ts).

const eventWithParticipantsArgs = {
  include: { participants: true, certificate: { select: { id: true, name: true, earningMethod: true } } },
} satisfies Prisma.InternalTrainingEventDefaultArgs;

export type InternalTrainingEventWithParticipants = Prisma.InternalTrainingEventGetPayload<
  typeof eventWithParticipantsArgs
>;

export function serializeInternalTrainingEvent(
  event: InternalTrainingEvent | InternalTrainingEventWithParticipants
) {
  return {
    id: event.id.toString(),
    buyerOrganizationId: event.buyerOrganizationId.toString(),
    createdByUserId: event.createdByUserId,
    certificateId: event.certificateId.toString(),
    certificateName: "certificate" in event ? event.certificate.name : undefined,
    title: event.title,
    trainingDate: event.trainingDate.toISOString().slice(0, 10),
    equipmentDetails: event.equipmentDetails,
    trainerName: event.trainerName,
    status: event.status,
    participants: "participants" in event ? event.participants.map(serializeInternalTrainingParticipant) : undefined,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function serializeInternalTrainingParticipant(participant: InternalTrainingParticipant) {
  return {
    id: participant.id.toString(),
    eventId: participant.eventId.toString(),
    userId: participant.userId,
    hasEvidence: participant.evidenceKey !== null,
    uploadedByUserId: participant.uploadedByUserId,
    status: participant.status,
    reviewedAt: participant.reviewedAt ? participant.reviewedAt.toISOString() : null,
    reviewNote: participant.reviewNote,
    createdAt: participant.createdAt.toISOString(),
    updatedAt: participant.updatedAt.toISOString(),
  };
}

const EVENT_STATUSES = new Set<string>(Object.values(InternalTrainingEventStatus));

interface ParsedEventFields {
  title?: string;
  trainingDate?: Date;
  certificateId?: bigint;
  equipmentDetails?: string;
  trainerName?: string;
  status?: InternalTrainingEventStatus;
}

// Manual field-by-field validation, matching lib/listings.ts's
// parseListingFields style (partial mirrors Laravel's `sometimes` rule set,
// reused here for PATCH).
export function parseEventFields(body: unknown, opts: { partial: boolean }): ParsedEventFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: ParsedEventFields = {};

  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const require = (key: string) => !opts.partial || has(key);

  if (require("title")) {
    if (typeof b.title !== "string" || !b.title.trim()) {
      errors.title = ["title is required."];
    } else {
      result.title = b.title.trim();
    }
  }

  if (require("trainingDate")) {
    const parsed = typeof b.trainingDate === "string" ? new Date(b.trainingDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      errors.trainingDate = ["trainingDate must be a valid date."];
    } else {
      result.trainingDate = parsed;
    }
  }

  if (require("certificateId")) {
    const raw = b.certificateId;
    const str = typeof raw === "number" ? String(raw) : raw;
    if (typeof str !== "string" || !/^\d+$/.test(str)) {
      errors.certificateId = ["certificateId must be a certificate id."];
    } else {
      result.certificateId = BigInt(str);
    }
  }

  if (require("equipmentDetails")) {
    if (typeof b.equipmentDetails !== "string" || !b.equipmentDetails.trim()) {
      errors.equipmentDetails = ["equipmentDetails is required."];
    } else {
      result.equipmentDetails = b.equipmentDetails.trim();
    }
  }

  if (require("trainerName")) {
    if (typeof b.trainerName !== "string" || !b.trainerName.trim()) {
      errors.trainerName = ["trainerName is required."];
    } else {
      result.trainerName = b.trainerName.trim();
    }
  }

  if (has("status")) {
    if (typeof b.status !== "string" || !EVENT_STATUSES.has(b.status)) {
      errors.status = ["status must be one of submitted, completed."];
    } else {
      result.status = b.status as InternalTrainingEventStatus;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return result;
}

export class InternalTrainingCertificateNotFoundError extends Error {
  constructor() {
    super("Certificate not found.");
  }
}

// CAs select from the pool of already-approved certificates; they never
// author definitions (see the schema comment on InternalTrainingEvent).
export class InternalTrainingCertificateNotApprovedError extends Error {
  constructor() {
    super("Only an approved certificate can be used for an internal training event.");
  }
}

async function assertCertificateEligible(tx: Prisma.TransactionClient, certificateId: bigint): Promise<void> {
  const certificate = await tx.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate) throw new InternalTrainingCertificateNotFoundError();
  if (certificate.status !== "approved") throw new InternalTrainingCertificateNotApprovedError();
}

interface CreateEventParams {
  buyerOrganizationId: bigint;
  createdByUserId: string;
  title: string;
  trainingDate: Date;
  certificateId: bigint;
  equipmentDetails: string;
  trainerName: string;
}

export async function createInternalTrainingEvent(
  params: CreateEventParams
): Promise<InternalTrainingEventWithParticipants> {
  return prisma.$transaction(async (tx) => {
    await assertCertificateEligible(tx, params.certificateId);

    const event = await tx.internalTrainingEvent.create({
      data: {
        buyerOrganizationId: params.buyerOrganizationId,
        createdByUserId: params.createdByUserId,
        title: params.title,
        trainingDate: params.trainingDate,
        certificateId: params.certificateId,
        equipmentDetails: params.equipmentDetails,
        trainerName: params.trainerName,
      },
      ...eventWithParticipantsArgs,
    });

    await tx.activityLog.create({
      data: {
        userId: params.createdByUserId,
        actionType: ActivityActionType.internal_training_event_created,
        description: `Created internal training event "${event.title}".`,
      },
    });

    return event;
  });
}

export class InternalTrainingEventNotFoundError extends Error {
  constructor() {
    super("Internal training event not found.");
  }
}

export async function getOrgEvent(
  eventId: bigint,
  buyerOrganizationId: bigint
): Promise<InternalTrainingEventWithParticipants | null> {
  const event = await prisma.internalTrainingEvent.findUnique({ where: { id: eventId }, ...eventWithParticipantsArgs });
  if (!event || event.buyerOrganizationId !== buyerOrganizationId) return null;
  return event;
}

export function listOrgEvents(buyerOrganizationId: bigint): Promise<InternalTrainingEventWithParticipants[]> {
  return prisma.internalTrainingEvent.findMany({
    where: { buyerOrganizationId },
    orderBy: { createdAt: "desc" },
    ...eventWithParticipantsArgs,
  });
}

interface UpdateEventParams {
  eventId: bigint;
  buyerOrganizationId: bigint;
  fields: ParsedEventFields;
}

export async function updateInternalTrainingEvent(
  params: UpdateEventParams
): Promise<InternalTrainingEventWithParticipants> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.internalTrainingEvent.findUnique({ where: { id: params.eventId } });
    if (!existing || existing.buyerOrganizationId !== params.buyerOrganizationId) {
      throw new InternalTrainingEventNotFoundError();
    }

    if (params.fields.certificateId !== undefined) {
      await assertCertificateEligible(tx, params.fields.certificateId);
    }

    return tx.internalTrainingEvent.update({
      where: { id: params.eventId },
      data: {
        ...(params.fields.title !== undefined ? { title: params.fields.title } : {}),
        ...(params.fields.trainingDate !== undefined ? { trainingDate: params.fields.trainingDate } : {}),
        ...(params.fields.certificateId !== undefined ? { certificateId: params.fields.certificateId } : {}),
        ...(params.fields.equipmentDetails !== undefined ? { equipmentDetails: params.fields.equipmentDetails } : {}),
        ...(params.fields.trainerName !== undefined ? { trainerName: params.fields.trainerName } : {}),
        ...(params.fields.status !== undefined ? { status: params.fields.status } : {}),
      },
      ...eventWithParticipantsArgs,
    });
  });
}

// Reject any userId that isn't a member of the CA's own organization —
// a product decision from the brief, not a general access-control default.
export class ParticipantNotInOrganizationError extends Error {
  constructor() {
    super("This user does not belong to your organization.");
  }
}

// A product decision from the brief: the CA cannot include themselves as a
// participant on an event they sign off.
export class SelfSignoffNotAllowedError extends Error {
  constructor() {
    super("You cannot add yourself as a participant on an event you sign off.");
  }
}

export class ParticipantAlreadyAddedError extends Error {
  constructor() {
    super("This user is already a participant on this event.");
  }
}

interface AddParticipantParams {
  eventId: bigint;
  buyerOrganizationId: bigint;
  userId: string;
  actingUserId: string;
}

export async function addParticipant(params: AddParticipantParams): Promise<InternalTrainingParticipant> {
  if (params.userId === params.actingUserId) {
    throw new SelfSignoffNotAllowedError();
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.internalTrainingEvent.findUnique({ where: { id: params.eventId } });
    if (!event || event.buyerOrganizationId !== params.buyerOrganizationId) {
      throw new InternalTrainingEventNotFoundError();
    }

    const targetUser = await tx.user.findUnique({ where: { id: params.userId } });
    if (!targetUser || targetUser.buyerOrganizationId !== params.buyerOrganizationId) {
      throw new ParticipantNotInOrganizationError();
    }

    const existing = await tx.internalTrainingParticipant.findUnique({
      where: { eventId_userId: { eventId: params.eventId, userId: params.userId } },
    });
    if (existing) throw new ParticipantAlreadyAddedError();

    return tx.internalTrainingParticipant.create({
      data: { eventId: params.eventId, userId: params.userId },
    });
  });
}

export class InternalTrainingParticipantNotFoundError extends Error {
  constructor() {
    super("Participant not found.");
  }
}

interface RemoveParticipantParams {
  eventId: bigint;
  buyerOrganizationId: bigint;
  participantId: bigint;
}

export async function removeParticipant(params: RemoveParticipantParams): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const event = await tx.internalTrainingEvent.findUnique({ where: { id: params.eventId } });
    if (!event || event.buyerOrganizationId !== params.buyerOrganizationId) {
      throw new InternalTrainingEventNotFoundError();
    }

    const participant = await tx.internalTrainingParticipant.findUnique({ where: { id: params.participantId } });
    if (!participant || participant.eventId !== params.eventId) {
      throw new InternalTrainingParticipantNotFoundError();
    }

    await tx.internalTrainingParticipant.delete({ where: { id: params.participantId } });
  });
}

// Fetches a participant scoped by (participantId, eventId, buyerOrganizationId)
// in one go — shared by the evidence-upload and review paths, both of which
// need the same "does this participant belong to an event in this
// organization" check before doing anything else.
async function findOrgParticipant(
  tx: Prisma.TransactionClient,
  params: { participantId: bigint; buyerOrganizationId: bigint }
): Promise<InternalTrainingParticipant & { event: InternalTrainingEvent }> {
  const participant = await tx.internalTrainingParticipant.findUnique({
    where: { id: params.participantId },
    include: { event: true },
  });
  if (!participant || participant.event.buyerOrganizationId !== params.buyerOrganizationId) {
    throw new InternalTrainingParticipantNotFoundError();
  }
  return participant;
}

// Plain lookup (no org-scoping) — the route layer uses this to decide
// authorization itself, since the evidence-upload path accepts two different
// authorized parties (the participant themselves, or any CA of the event's
// organization) rather than a single org-scoped actor like every other
// function in this module.
export function getParticipantWithEvent(
  participantId: bigint
): Promise<(InternalTrainingParticipant & { event: InternalTrainingEvent }) | null> {
  return prisma.internalTrainingParticipant.findUnique({
    where: { id: participantId },
    include: { event: true },
  });
}

// Pure — no DB/session dependency, so it's directly unit-testable and shared
// by both evidence routes (upload-url and evidence) instead of duplicating
// the isSelf/isOrgAdmin check inline in each. Either the participant
// themselves, or any CA (isBuyerOrgAdmin) of the event's own organization,
// is authorized; everyone else is rejected.
export function isAuthorizedForEvidenceUpload(params: {
  participantUserId: string;
  eventBuyerOrganizationId: bigint;
  actingUserId: string;
  actingIsBuyerOrgAdmin: boolean;
  actingBuyerOrganizationId: string | null;
}): boolean {
  if (params.actingUserId === params.participantUserId) return true;
  return params.actingIsBuyerOrgAdmin && params.actingBuyerOrganizationId === params.eventBuyerOrganizationId.toString();
}

// DB-only, no storage dependency — same "route confirms the object exists in
// R2 first, this function just records the key" split as
// lib/certificate-signoffs.ts's submitSignoffRequest. Either the CA or the
// participant themselves may call this; the route enforces which.
interface UploadEvidenceParams {
  participantId: bigint;
  buyerOrganizationId: bigint;
  evidenceKey: string;
  uploadedByUserId: string;
}

export async function uploadParticipantEvidence(params: UploadEvidenceParams): Promise<InternalTrainingParticipant> {
  return prisma.$transaction(async (tx) => {
    const participant = await findOrgParticipant(tx, params);

    const updated = await tx.internalTrainingParticipant.update({
      where: { id: params.participantId },
      data: {
        evidenceKey: params.evidenceKey,
        uploadedByUserId: params.uploadedByUserId,
        // Only advance out of pending_evidence — a re-upload against an
        // already-awaiting_signoff row (e.g. replacing a blurry photo)
        // shouldn't regress a terminal passed/failed row back to
        // awaiting_signoff.
        ...(participant.status === InternalTrainingParticipantStatus.pending_evidence
          ? { status: InternalTrainingParticipantStatus.awaiting_signoff }
          : {}),
      },
    });

    await tx.activityLog.create({
      data: {
        userId: params.uploadedByUserId,
        actionType: ActivityActionType.internal_training_evidence_uploaded,
        description: `Uploaded evidence for an internal training participant.`,
      },
    });

    return updated;
  });
}

export type ParticipantDecision = "pass" | "fail";

// Evidence is mandatory before a pass (a product decision from the brief) —
// a fail may be recorded with or without it.
export class EvidenceRequiredForPassError extends Error {
  constructor() {
    super("Evidence is required before a participant can be passed.");
  }
}

// Mirrors CertificateSignoffRequest's terminal-state protection: once
// passed/failed, no further review — a judgment call (not specified in the
// brief) made for consistency with that sibling flow.
export class ParticipantAlreadyReviewedError extends Error {
  constructor() {
    super("This participant has already been reviewed.");
  }
}

interface ReviewParticipantParams {
  participantId: bigint;
  buyerOrganizationId: bigint;
  reviewerId: string;
  decision: ParticipantDecision;
  reviewNote?: string | null;
}

export async function reviewParticipant(params: ReviewParticipantParams): Promise<InternalTrainingParticipant> {
  return prisma.$transaction(async (tx) => {
    const participant = await findOrgParticipant(tx, params);

    if (
      participant.status === InternalTrainingParticipantStatus.passed ||
      participant.status === InternalTrainingParticipantStatus.failed
    ) {
      throw new ParticipantAlreadyReviewedError();
    }

    if (params.decision === "pass" && participant.evidenceKey === null) {
      throw new EvidenceRequiredForPassError();
    }

    const updated = await tx.internalTrainingParticipant.update({
      where: { id: params.participantId },
      data: {
        status:
          params.decision === "pass"
            ? InternalTrainingParticipantStatus.passed
            : InternalTrainingParticipantStatus.failed,
        reviewedAt: new Date(),
        reviewNote: params.reviewNote ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: participant.userId,
        actionType: ActivityActionType.internal_training_participant_reviewed,
        description: `Internal training sign-off ${params.decision === "pass" ? "passed" : "failed"}.`,
      },
    });

    if (params.decision === "pass") {
      const certificate = await tx.certificate.findUniqueOrThrow({ where: { id: participant.event.certificateId } });
      await issueCredential(tx, {
        userId: participant.userId,
        certificateId: participant.event.certificateId,
        description: `Earned via internal company sign-off for "${certificate.name}".`,
        provenance: CredentialProvenance.tier2a1_internal_company_signoff,
      });
    }

    return updated;
  });
}

// Participant-side: every InternalTrainingEvent this user has an
// InternalTrainingParticipant row on, regardless of which organization
// created it (a user only ever belongs to one org, but this deliberately
// doesn't re-derive/assert that here — it's a pure "my own rows" lookup).
export function listParticipantEvents(userId: string): Promise<InternalTrainingEventWithParticipants[]> {
  return prisma.internalTrainingEvent.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    ...eventWithParticipantsArgs,
  });
}
