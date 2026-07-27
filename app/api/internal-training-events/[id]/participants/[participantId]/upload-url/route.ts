import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, forbiddenResponse, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { getParticipantWithEvent, isAuthorizedForEvidenceUpload } from "@/lib/internal-training-events";
import { buildInternalTrainingEvidenceKey, getEvidenceUploadUrl } from "@/lib/storage";

// Evidence here (per the brief) is "a photo of a gravimetric check, or a
// blank calibration run printout" — broader than tier2a's video-only
// recordings, so image/* plus application/pdf (a judgment call: permissive
// enough for both examples, still a real allowlist rather than accepting
// anything).
function isAllowedContentType(contentType: string): boolean {
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

// POST: presigned R2 PUT URL for a participant's evidence (a photo of a
// gravimetric check, a calibration printout, etc.) — reuses the same
// private-bucket presigned-PUT path built for tier2a evidence recordings
// (lib/storage.ts), not a second storage mechanism. Either the participant
// themselves or a CA of the event's organization may call this — see
// lib/internal-training-events.ts's own comment on why this authorization
// check lives at the route layer instead of being org-scoped like every
// other function in that module.
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
  const filename = typeof b.filename === "string" ? b.filename : null;
  const contentType = typeof b.contentType === "string" ? b.contentType : null;

  if (!filename || !contentType || !isAllowedContentType(contentType)) {
    return validationErrorResponse(
      new ApiValidationError({ contentType: ["filename is required and contentType must be image/* or application/pdf."] })
    );
  }

  const key = buildInternalTrainingEvidenceKey({ eventId, userId: participant.userId, filename });
  const uploadUrl = await getEvidenceUploadUrl({ key, contentType });

  return NextResponse.json({ uploadUrl, key });
}
