import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import {
  CertificateNotEligibleForSessionError,
  createTrainingSession,
  parseCreateSessionFields,
  serializeSupplierTrainingSession,
} from "@/lib/training-sessions";

// GET: the supplier's own company's training sessions, with the full
// participant namelist embedded (feeds both the session-row enrolled count
// and ViewNamelistModal off a single request — no separate namelist route).
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const trainingSessions = await prisma.trainingSession.findMany({
    where: { companyId: auth.companyId },
    include: {
      certificate: true,
      enrollments: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { sessionDatetime: "desc" },
  });

  return NextResponse.json({ trainingSessions: trainingSessions.map(serializeSupplierTrainingSession) });
}

// POST: create a training session for the caller's company. Only
// certificates earned via tier2b_operator_or_sme_signoff can be attached —
// see lib/training-sessions.ts for why.
export async function POST(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseCreateSessionFields(body);
    const session = await createTrainingSession({
      ...fields,
      companyId: auth.companyId,
      createdByUserId: auth.userId,
    });
    const created = await prisma.trainingSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { certificate: true, enrollments: { include: { user: { select: { name: true, email: true } } } } },
    });
    return NextResponse.json({ trainingSession: serializeSupplierTrainingSession(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof CertificateNotEligibleForSessionError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
