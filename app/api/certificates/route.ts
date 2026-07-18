import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, forbiddenResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseSubmissionFields, serializeCertificate } from "@/lib/certificates";

// GET: public catalog of approved certificates (mirrors old
// CertificateController::index, unauthenticated in routes/api.php).
export async function GET() {
  const certificates = await prisma.certificate.findMany({
    where: { status: "approved" },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ certificates: certificates.map(serializeCertificate) });
}

// POST: supplier submits a certificate for review (status=pending). Mirrors
// old CertificateController::store, gated by the `supplier` middleware
// there — same requirement enforced here via isSupplier + companyId.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();
  if (!session.user.isSupplier) return forbiddenResponse("This action requires supplier access.");
  if (!session.user.companyId) {
    return forbiddenResponse("You must belong to a company to submit a certificate.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseSubmissionFields(body);

    const certificate = await prisma.certificate.create({
      data: {
        name: fields.name,
        icon: fields.icon ?? null,
        category: fields.category ?? null,
        source: "supplier_created",
        status: "pending",
        createdByCompanyId: BigInt(session.user.companyId),
      },
    });

    return NextResponse.json({ certificate: serializeCertificate(certificate) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
