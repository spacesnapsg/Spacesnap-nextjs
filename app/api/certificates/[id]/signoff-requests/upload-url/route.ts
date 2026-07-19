import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { buildEvidenceRecordingKey, getEvidenceUploadUrl } from "@/lib/storage";

const ALLOWED_CONTENT_TYPE_PREFIX = "video/";

// POST: returns a presigned R2 PUT URL for an evidence recording — the
// client uploads the file bytes directly to R2 with this URL, then calls
// POST /api/certificates/[id]/signoff-requests with the returned `key` and
// submissionType: "recording". Separate endpoint (rather than accepting the
// file body directly here) so this Route Handler never proxies
// potentially-large video uploads — see lib/storage.ts's own comment on why.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const certificateId = parseBigIntParam(id);
  if (certificateId === null) return notFoundResponse("Certificate not found.");

  const certificate = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate) return notFoundResponse("Certificate not found.");

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const filename = typeof b.filename === "string" ? b.filename : null;
  const contentType = typeof b.contentType === "string" ? b.contentType : null;

  if (!filename || !contentType || !contentType.startsWith(ALLOWED_CONTENT_TYPE_PREFIX)) {
    return validationErrorResponse(
      new ApiValidationError({
        contentType: ["filename is required and contentType must be a video/* mime type."],
      })
    );
  }

  const key = buildEvidenceRecordingKey({ certificateId, userId: session.user.id, filename });
  const uploadUrl = await getEvidenceUploadUrl({ key, contentType });

  return NextResponse.json({ uploadUrl, key });
}
