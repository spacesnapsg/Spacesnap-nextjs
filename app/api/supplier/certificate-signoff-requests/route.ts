import { NextRequest, NextResponse } from "next/server";
import { SignoffRequestStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { getEvidenceViewUrl } from "@/lib/storage";
import { serializeSignoffRequest } from "@/lib/certificate-signoffs";

const STATUSES = new Set<string>(Object.values(SignoffRequestStatus));

// GET: the reviewer queue for tier2a_operator_signoff requests against
// certificates this supplier's company created (Certificate.createdByCompanyId)
// — platform-authored tier2a certs (createdByCompanyId null) have no company
// to scope to and are reviewed by system admin instead, see
// GET /api/admin/certificate-signoff-requests. ?status= filters (defaults to
// showing everything, including already-reviewed requests, so a supplier can
// see history, not just the open queue).
export async function GET(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !STATUSES.has(status)) {
    return validationErrorResponse(
      new ApiValidationError({ status: ["status must be one of pending, live_demo_requested, passed, failed."] })
    );
  }

  const requests = await prisma.certificateSignoffRequest.findMany({
    where: {
      certificate: { createdByCompanyId: auth.companyId },
      ...(status ? { status: status as SignoffRequestStatus } : {}),
    },
    include: { user: true, certificate: true },
    orderBy: { createdAt: "desc" },
  });

  const withUrls = await Promise.all(
    requests.map(async (r) => ({
      ...serializeSignoffRequest(r),
      userName: r.user.name,
      certificateName: r.certificate.name,
      recordingUrl: r.recordingKey ? await getEvidenceViewUrl(r.recordingKey) : null,
    }))
  );

  return NextResponse.json({ signoffRequests: withUrls });
}
