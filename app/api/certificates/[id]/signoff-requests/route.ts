import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { evidenceRecordingExists, getEvidenceViewUrl } from "@/lib/storage";
import {
  parseSignoffSubmission,
  serializeSignoffRequest,
  SignoffCertificateNotFoundError,
  SignoffRequestInProgressError,
  SignoffWrongEarningMethodError,
  submitSignoffRequest,
} from "@/lib/certificate-signoffs";

// GET: the caller's own sign-off request for this certificate, if any — one
// record per (user, certificate), so this is a single object, not a list.
// Includes a short-lived presigned view URL for the evidence recording
// (never the raw R2 key/a public URL — see lib/storage.ts).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const certificateId = parseBigIntParam(id);
  if (certificateId === null) return notFoundResponse("Certificate not found.");

  const existing = await prisma.certificateSignoffRequest.findUnique({
    where: { userId_certificateId: { userId: session.user.id, certificateId } },
  });
  if (!existing) return NextResponse.json({ signoffRequest: null });

  const recordingUrl = existing.recordingKey ? await getEvidenceViewUrl(existing.recordingKey) : null;
  return NextResponse.json({ signoffRequest: { ...serializeSignoffRequest(existing), recordingUrl } });
}

// POST: submit (or resubmit, after a terminal passed/failed outcome) a
// tier2a_operator_signoff request. For submissionType: "recording", the
// client must have already uploaded the file to the key returned by
// POST .../upload-url — this route confirms the object actually exists in
// R2 before accepting the submission, so a client can't fabricate a
// recordingKey without having actually uploaded anything.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const certificateId = parseBigIntParam(id);
  if (certificateId === null) return notFoundResponse("Certificate not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseSignoffSubmission(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  if (fields.recordingKey) {
    const exists = await evidenceRecordingExists(fields.recordingKey);
    if (!exists) {
      return validationErrorResponse(
        new ApiValidationError({ recordingKey: ["No uploaded recording was found for this key."] })
      );
    }
  }

  try {
    const created = await submitSignoffRequest({
      userId: session.user.id,
      certificateId,
      submissionType: fields.submissionType,
      recordingKey: fields.recordingKey,
    });
    return NextResponse.json({ signoffRequest: serializeSignoffRequest(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof SignoffCertificateNotFoundError) return notFoundResponse(error.message);
    if (error instanceof SignoffWrongEarningMethodError) {
      return validationErrorResponse(new ApiValidationError({ certificateId: [error.message] }));
    }
    if (error instanceof SignoffRequestInProgressError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    throw error;
  }
}
