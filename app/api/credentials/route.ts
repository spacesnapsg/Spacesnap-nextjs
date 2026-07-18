import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";

// "Credentials" = the earned/held record (old system's user_certificates
// pivot: user, certificate, earned_date, expiry_date) — confirmed against
// the Sprint 2 Prisma schema's UserCertificate model, distinct from
// Certificate (the catalog/definition, handled in Session 4).
//
// Read-only this session by explicit decision: the old backend never had a
// write endpoint for user_certificates (only GET /me/certificates, mirrored
// below), "admin scope" is out of scope for Session 3, and the real
// issuance mechanism (training pass -> credential) is Sprint 4's job
// ("Training/credentialing flow ... issue credential"). Building a write
// path now would mean inventing an authorization boundary with no
// precedent in either the old repo or the sprint docs.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const credentials = await prisma.userCertificate.findMany({
    where: { userId: session.user.id },
    include: { certificate: true },
    orderBy: { earnedDate: "desc" },
  });

  return NextResponse.json({
    credentials: credentials.map((c) => ({
      id: c.id.toString(),
      certificateId: c.certificateId.toString(),
      earnedDate: c.earnedDate.toISOString().slice(0, 10),
      expiryDate: c.expiryDate ? c.expiryDate.toISOString().slice(0, 10) : null,
      certificate: {
        id: c.certificate.id.toString(),
        name: c.certificate.name,
        icon: c.certificate.icon,
        category: c.certificate.category,
        source: c.certificate.source,
        status: c.certificate.status,
      },
    })),
  });
}
