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

// POST: submits a certificate for review (status=pending) into the system
// admin approval queue. Mirrors old CertificateController::store (supplier,
// gated by isSupplier + companyId) — extended (session:
// feat/internal-training-signoff) so a buyer-org company admin (CA) can
// submit into the exact same queue, since CAs pick from the approved-
// certificate pool for internal training events but never author
// definitions themselves. `source` records WHICH ROLE submitted it;
// createdByCompanyId stays null for a CA submission (Certificate has no
// BuyerOrganization FK to attribute one to — see the schema comment on
// CertificateSource.buyer_org_created). A "Both"-role account (isSupplier
// and isBuyerOrgAdmin) submits as the supplier, matching its pre-existing
// behavior.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const isSupplierSubmission = session.user.isSupplier && session.user.companyId !== null;
  const isBuyerOrgAdminSubmission = session.user.isBuyerOrgAdmin && session.user.buyerOrganizationId !== null;
  if (!isSupplierSubmission && !isBuyerOrgAdminSubmission) {
    return forbiddenResponse("This action requires supplier or company admin access.");
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
        source: isSupplierSubmission ? "supplier_created" : "buyer_org_created",
        status: "pending",
        createdByCompanyId: isSupplierSubmission ? BigInt(session.user.companyId!) : null,
      },
    });

    return NextResponse.json({ certificate: serializeCertificate(certificate) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
