import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  addParticipant,
  InternalTrainingEventNotFoundError,
  ParticipantAlreadyAddedError,
  ParticipantNotInOrganizationError,
  SelfSignoffNotAllowedError,
  serializeInternalTrainingParticipant,
} from "@/lib/internal-training-events";

// CA-only: add a participant to an internal training event they own. One
// row per person per event — evidence upload happens separately, see
// app/api/internal-training-events/[id]/participants/[participantId].
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const eventId = parseBigIntParam(id);
  if (eventId === null) return notFoundResponse("Internal training event not found.");

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.userId !== "string" || !b.userId.trim()) {
    return validationErrorResponse(new ApiValidationError({ userId: ["userId is required."] }));
  }

  try {
    const participant = await addParticipant({
      eventId,
      buyerOrganizationId: auth.buyerOrganizationId,
      userId: b.userId,
      actingUserId: auth.userId,
    });
    return NextResponse.json({ participant: serializeInternalTrainingParticipant(participant) }, { status: 201 });
  } catch (error) {
    if (error instanceof InternalTrainingEventNotFoundError) return notFoundResponse(error.message);
    if (error instanceof SelfSignoffNotAllowedError) {
      return validationErrorResponse(new ApiValidationError({ userId: [error.message] }));
    }
    if (error instanceof ParticipantNotInOrganizationError) {
      return validationErrorResponse(new ApiValidationError({ userId: [error.message] }));
    }
    if (error instanceof ParticipantAlreadyAddedError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    throw error;
  }
}
