import { NextRequest, NextResponse } from "next/server";
import { SignoffRequestStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { getEvidenceViewUrl } from "@/lib/storage";
import { serializeSignoffRequest } from "@/lib/certificate-signoffs";

const STATUSES = new Set<string>(Object.values(SignoffRequestStatus));

// GET: system-admin counterpart to GET /api/supplier/certificate-signoff-requests
// — reviews requests against platform-authored tier2a_operator_signoff
// certificates (Certificate.createdByCompanyId is null), which have no
// company to scope a supplier queue to.
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !STATUSES.has(status)) {
    return validationErrorResponse(
      new ApiValidationError({ status: ["status must be one of pending, live_demo_requested, passed, failed."] })
    );
  }

  const requests = await prisma.certificateSignoffRequest.findMany({
    where: {
      certificate: { createdByCompanyId: null },
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
