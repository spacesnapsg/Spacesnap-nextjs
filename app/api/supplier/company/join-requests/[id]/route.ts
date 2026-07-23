import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  resolveCompanyJoinRequest,
  NotCompanyAdminError,
  CompanyJoinRequestNotFoundError,
  CompanyJoinRequestNotPendingError,
} from "@/lib/company-membership";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

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
    const updated = await resolveCompanyJoinRequest(auth.userId, requestId, status);
    return NextResponse.json({
      request: { id: updated.id.toString(), status: updated.status },
    });
  } catch (error) {
    if (error instanceof CompanyJoinRequestNotFoundError) return notFoundResponse(error.message);
    if (error instanceof CompanyJoinRequestNotPendingError) {
      return validationErrorResponse(new ApiValidationError({ status: [error.message] }));
    }
    if (error instanceof NotCompanyAdminError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
