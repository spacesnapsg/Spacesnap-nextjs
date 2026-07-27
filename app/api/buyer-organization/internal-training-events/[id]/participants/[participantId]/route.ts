import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  EvidenceRequiredForPassError,
  InternalTrainingEventNotFoundError,
  InternalTrainingParticipantNotFoundError,
  ParticipantAlreadyReviewedError,
  ParticipantDecision,
  removeParticipant,
  reviewParticipant,
  serializeInternalTrainingParticipant,
} from "@/lib/internal-training-events";

const DECISIONS = new Set<string>(["pass", "fail"]);

function parseParams(idRaw: string, participantIdRaw: string) {
  const eventId = parseBigIntParam(idRaw);
  const participantId = parseBigIntParam(participantIdRaw);
  return { eventId, participantId };
}

// CA-only: remove a participant from an event they own.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const { id, participantId: participantIdRaw } = await params;
  const { eventId, participantId } = parseParams(id, participantIdRaw);
  if (eventId === null || participantId === null) return notFoundResponse("Participant not found.");

  try {
    await removeParticipant({ eventId, buyerOrganizationId: auth.buyerOrganizationId, participantId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof InternalTrainingParticipantNotFoundError) return notFoundResponse(error.message);
    if (error instanceof InternalTrainingEventNotFoundError) return notFoundResponse(error.message);
    throw error;
  }
}

// CA-only: pass/fail sign-off decision on a participant. On pass, issues the
// credential via lib/training-credentials.ts with
// tier2a1_internal_company_signoff provenance (see reviewParticipant).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const { id, participantId: participantIdRaw } = await params;
  const { eventId, participantId } = parseParams(id, participantIdRaw);
  if (eventId === null || participantId === null) return notFoundResponse("Participant not found.");

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.decision !== "string" || !DECISIONS.has(b.decision)) {
    return validationErrorResponse(new ApiValidationError({ decision: ["decision must be one of pass, fail."] }));
  }
  const reviewNote = typeof b.reviewNote === "string" ? b.reviewNote : null;

  try {
    const participant = await reviewParticipant({
      participantId,
      buyerOrganizationId: auth.buyerOrganizationId,
      reviewerId: auth.userId,
      decision: b.decision as ParticipantDecision,
      reviewNote,
    });
    return NextResponse.json({ participant: serializeInternalTrainingParticipant(participant) });
  } catch (error) {
    if (error instanceof InternalTrainingParticipantNotFoundError) return notFoundResponse(error.message);
    if (error instanceof EvidenceRequiredForPassError) {
      return validationErrorResponse(new ApiValidationError({ decision: [error.message] }));
    }
    if (error instanceof ParticipantAlreadyReviewedError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
