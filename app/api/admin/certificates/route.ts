import { NextRequest, NextResponse } from "next/server";
import { Prisma, type CertificateStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { parseAdminCreateFields, serializeCertificate } from "@/lib/certificates";

const CERTIFICATE_STATUSES = new Set<string>(["pending", "approved", "rejected"]);
const PER_PAGE = 15;

// GET: full catalog, admin view. Mirrors old CertificateController::adminIndex
// (status + search filters, paginated).
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  if (status && !CERTIFICATE_STATUSES.has(status)) {
    return NextResponse.json(
      { message: "status must be one of pending, approved, rejected." },
      { status: 422 }
    );
  }

  const where: Prisma.CertificateWhereInput = {
    ...(status ? { status: status as CertificateStatus } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [certificates, total] = await Promise.all([
    prisma.certificate.findMany({
      where,
      include: { createdByCompany: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.certificate.count({ where }),
  ]);

  return NextResponse.json({
    certificates: certificates.map(serializeCertificate),
    meta: { page, perPage: PER_PAGE, total },
  });
}

// POST: admin creates a certificate directly into the approved catalog
// (source=platform, status=approved, no review needed). Mirrors old
// CertificateController::adminStore.
export async function POST(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseAdminCreateFields(body);

    const certificate = await prisma.certificate.create({
      data: {
        name: fields.name,
        category: fields.category ?? null,
        submissionNotes: fields.submissionNotes ?? null,
        source: "platform",
        status: "approved",
        createdByCompanyId: null,
      },
    });

    return NextResponse.json({ certificate: serializeCertificate(certificate) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
