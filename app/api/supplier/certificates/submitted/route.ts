import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { serializeCertificate } from "@/lib/certificates";

// Mirrors old CertificateController::mySubmissions — lets a supplier see the
// review status of certificates their company has submitted.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const certificates = await prisma.certificate.findMany({
    where: { createdByCompanyId: auth.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ certificates: certificates.map(serializeCertificate) });
}
