import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  getOrgEvent,
  InternalTrainingCertificateNotApprovedError,
  InternalTrainingCertificateNotFoundError,
  InternalTrainingEventNotFoundError,
  parseEventFields,
  serializeInternalTrainingEvent,
  updateInternalTrainingEvent,
} from "@/lib/internal-training-events";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const eventId = parseBigIntParam(id);
  if (eventId === null) return notFoundResponse("Internal training event not found.");

  const event = await getOrgEvent(eventId, auth.buyerOrganizationId);
  if (!event) return notFoundResponse("Internal training event not found.");

  return NextResponse.json({ event: serializeInternalTrainingEvent(event) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const eventId = parseBigIntParam(id);
  if (eventId === null) return notFoundResponse("Internal training event not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseEventFields(body, { partial: true });
    const event = await updateInternalTrainingEvent({ eventId, buyerOrganizationId: auth.buyerOrganizationId, fields });
    return NextResponse.json({ event: serializeInternalTrainingEvent(event) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof InternalTrainingEventNotFoundError) return notFoundResponse(error.message);
    if (error instanceof InternalTrainingCertificateNotFoundError) return notFoundResponse(error.message);
    if (error instanceof InternalTrainingCertificateNotApprovedError) {
      return validationErrorResponse(new ApiValidationError({ certificateId: [error.message] }));
    }
    throw error;
  }
}
