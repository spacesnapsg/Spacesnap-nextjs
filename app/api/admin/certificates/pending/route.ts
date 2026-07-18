import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { serializeCertificate } from "@/lib/certificates";

// Mirrors old CertificateController::pending — the review queue.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const certificates = await prisma.certificate.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ certificates: certificates.map(serializeCertificate) });
}
