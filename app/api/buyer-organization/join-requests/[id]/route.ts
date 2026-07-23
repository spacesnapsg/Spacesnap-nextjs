import { NextResponse } from "next/server";
import { requireBuyerOrgAdmin } from "@/lib/buyer-org-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  resolveBuyerOrgJoinRequest,
  NotBuyerOrgAdminError,
  BuyerOrgJoinRequestNotFoundError,
  BuyerOrgJoinRequestNotPendingError,
} from "@/lib/buyer-organizations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  const requestId = parseBigIntParam(id);
  if (requestId === null) return notFoundResponse("Join request not found.");

  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
  if (status !== "approved" && status !== "rejected") {
    return validationErrorResponse(
      new ApiValidationError({ status: ['status must be "approved" or "rejected".'] })
    );
  }

  try {
    const updated = await resolveBuyerOrgJoinRequest(authResult.userId, requestId, status);
    return NextResponse.json({
      request: { id: updated.id.toString(), status: updated.status },
    });
  } catch (error) {
    if (error instanceof BuyerOrgJoinRequestNotFoundError) return notFoundResponse(error.message);
    if (error instanceof BuyerOrgJoinRequestNotPendingError) {
      return validationErrorResponse(new ApiValidationError({ status: [error.message] }));
    }
    if (error instanceof NotBuyerOrgAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
