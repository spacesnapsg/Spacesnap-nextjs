import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, forbiddenResponse, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  InvalidSignoffTransitionError,
  reviewSignoffRequest,
  serializeSignoffRequest,
  SignoffDecision,
  SignoffRequestNotFoundError,
} from "@/lib/certificate-signoffs";

const DECISIONS = new Set<string>(["pass", "fail", "request_live_demo"]);

// PATCH: reviewer decision on a tier2a_operator_signoff request. Review
// authority mirrors the two queue endpoints' scoping: a supplier at the
// certificate's createdByCompanyId, or a system admin if the certificate is
// platform-authored (createdByCompanyId null) — checked here per-request
// (rather than via requireSupplier()/requireSystemAdmin() alone) since which
// one applies depends on the specific certificate being reviewed.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const requestId = parseBigIntParam(id);
  if (requestId === null) return notFoundResponse("Sign-off request not found.");

  const existing = await prisma.certificateSignoffRequest.findUnique({
    where: { id: requestId },
    include: { certificate: true },
  });
  if (!existing) return notFoundResponse("Sign-off request not found.");

  const companyId = existing.certificate.createdByCompanyId;
  const isAuthorizedSupplier = session.user.isSupplier && companyId !== null && session.user.companyId === companyId.toString();
  const isAuthorizedAdmin = companyId === null && session.user.isSystemAdmin;
  if (!isAuthorizedSupplier && !isAuthorizedAdmin) {
    return forbiddenResponse("You do not have access to review this sign-off request.");
  }

  const body = await request.json().catch(() => null);
  const decision = (body && typeof body === "object" ? (body as Record<string, unknown>).decision : undefined) as unknown;
  if (typeof decision !== "string" || !DECISIONS.has(decision)) {
    return validationErrorResponse(
      new ApiValidationError({ decision: ["decision must be one of pass, fail, request_live_demo."] })
    );
  }

  try {
    const updated = await reviewSignoffRequest({
      requestId,
      reviewerId: session.user.id,
      decision: decision as SignoffDecision,
    });
    return NextResponse.json({ signoffRequest: serializeSignoffRequest(updated) });
  } catch (error) {
    if (error instanceof SignoffRequestNotFoundError) return notFoundResponse(error.message);
    if (error instanceof InvalidSignoffTransitionError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
