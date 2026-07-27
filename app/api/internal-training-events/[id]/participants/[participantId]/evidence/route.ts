import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, forbiddenResponse, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { evidenceRecordingExists } from "@/lib/storage";
import {
  getParticipantWithEvent,
  isAuthorizedForEvidenceUpload,
  serializeInternalTrainingParticipant,
  uploadParticipantEvidence,
} from "@/lib/internal-training-events";

// POST: confirms an evidence file was actually uploaded to the key returned
// by .../upload-url (same existence-check discipline as
// POST /api/certificates/[id]/signoff-requests — a client can't fabricate a
// key without having actually PUT the object) and records it on the
// participant row. Same dual authorization as upload-url: the participant
// themselves, or a CA of the event's organization.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id, participantId: participantIdRaw } = await params;
  const eventId = parseBigIntParam(id);
  const participantId = parseBigIntParam(participantIdRaw);
  if (eventId === null || participantId === null) return notFoundResponse("Participant not found.");

  const participant = await getParticipantWithEvent(participantId);
  if (!participant || participant.eventId !== eventId) return notFoundResponse("Participant not found.");

  const authorized = isAuthorizedForEvidenceUpload({
    participantUserId: participant.userId,
    eventBuyerOrganizationId: participant.event.buyerOrganizationId,
    actingUserId: session.user.id,
    actingIsBuyerOrgAdmin: session.user.isBuyerOrgAdmin,
    actingBuyerOrganizationId: session.user.buyerOrganizationId,
  });
  if (!authorized) {
    return forbiddenResponse("You do not have access to upload evidence for this participant.");
  }

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.key !== "string" || !b.key.trim()) {
    return validationErrorResponse(new ApiValidationError({ key: ["key is required."] }));
  }

  const exists = await evidenceRecordingExists(b.key);
  if (!exists) {
    return validationErrorResponse(new ApiValidationError({ key: ["No uploaded evidence file was found for this key."] }));
  }

  const updated = await uploadParticipantEvidence({
    participantId,
    buyerOrganizationId: participant.event.buyerOrganizationId,
    evidenceKey: b.key,
    uploadedByUserId: session.user.id,
  });

  return NextResponse.json({ participant: serializeInternalTrainingParticipant(updated) });
}
