import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  createInternalTrainingEvent,
  InternalTrainingCertificateNotApprovedError,
  InternalTrainingCertificateNotFoundError,
  listOrgEvents,
  parseEventFields,
  serializeInternalTrainingEvent,
} from "@/lib/internal-training-events";

// CA-only: create/list internal training events for the CA's own
// BuyerOrganization. Company-admin-scoped the same way requireSupplier()'s
// callers scope to companyId — see requireBuyerOrgAdmin, lib/buyer-org-auth.ts.
export async function GET() {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const events = await listOrgEvents(auth.buyerOrganizationId);
  return NextResponse.json({ events: events.map(serializeInternalTrainingEvent) });
}

export async function POST(request: NextRequest) {
  const auth = await requireBuyerOrgAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseEventFields(body, { partial: false });

    const event = await createInternalTrainingEvent({
      buyerOrganizationId: auth.buyerOrganizationId,
      createdByUserId: auth.userId,
      title: fields.title!,
      trainingDate: fields.trainingDate!,
      certificateId: fields.certificateId!,
      equipmentDetails: fields.equipmentDetails!,
      trainerName: fields.trainerName!,
    });

    return NextResponse.json({ event: serializeInternalTrainingEvent(event) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof InternalTrainingCertificateNotFoundError) return notFoundResponse(error.message);
    if (error instanceof InternalTrainingCertificateNotApprovedError) {
      return validationErrorResponse(new ApiValidationError({ certificateId: [error.message] }));
    }
    throw error;
  }
}
