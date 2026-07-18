import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { CertificateNotPendingError, reviewCertificate, serializeCertificate } from "@/lib/certificates";

// Mirrors old CertificateController::reject.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const certificateId = parseBigIntParam(id);
  if (certificateId === null) return notFoundResponse("Certificate not found.");

  try {
    const certificate = await reviewCertificate(certificateId, "rejected", auth.userId);
    if (!certificate) return notFoundResponse("Certificate not found.");

    return NextResponse.json({ certificate: serializeCertificate(certificate) });
  } catch (error) {
    if (error instanceof CertificateNotPendingError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
