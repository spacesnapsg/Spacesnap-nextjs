import type { Certificate, CertificateStatus, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const certificateWithCompanyArgs = {
  include: { createdByCompany: true },
} satisfies Prisma.CertificateDefaultArgs;

export type CertificateWithCompany = Prisma.CertificateGetPayload<typeof certificateWithCompanyArgs>;

export function serializeCertificate(certificate: Certificate | CertificateWithCompany) {
  return {
    id: certificate.id.toString(),
    name: certificate.name,
    icon: certificate.icon,
    category: certificate.category,
    submissionNotes: certificate.submissionNotes,
    source: certificate.source,
    status: certificate.status,
    createdByCompanyId: certificate.createdByCompanyId?.toString() ?? null,
    createdByCompanyName:
      "createdByCompany" in certificate ? (certificate.createdByCompany?.name ?? null) : undefined,
    reviewedBy: certificate.reviewedBy,
    reviewedAt: certificate.reviewedAt ? certificate.reviewedAt.toISOString() : null,
    createdAt: certificate.createdAt.toISOString(),
    updatedAt: certificate.updatedAt.toISOString(),
  };
}

interface ParsedSubmissionFields {
  name: string;
  icon?: string | null;
  category?: string | null;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

// Mirrors CertificateController::store's validation (supplier submission —
// name required, icon/category optional). No submissionNotes field on the
// old store() route; only adminStore() accepts it.
export function parseSubmissionFields(body: unknown): ParsedSubmissionFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: Partial<ParsedSubmissionFields> = {};

  if (typeof b.name !== "string" || !b.name.trim()) {
    errors.name = ["name is required."];
  } else {
    result.name = b.name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(b, "icon")) {
    if (!isNullableString(b.icon)) {
      errors.icon = ["icon must be a string."];
    } else {
      result.icon = b.icon ?? null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(b, "category")) {
    if (!isNullableString(b.category)) {
      errors.category = ["category must be a string."];
    } else {
      result.category = b.category ?? null;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return result as ParsedSubmissionFields;
}

interface ParsedAdminCreateFields {
  name: string;
  category?: string | null;
  submissionNotes?: string | null;
}

// Mirrors CertificateController::adminStore's validation (admin direct
// create — name required, category/submissionNotes optional, no icon field).
export function parseAdminCreateFields(body: unknown): ParsedAdminCreateFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: Partial<ParsedAdminCreateFields> = {};

  if (typeof b.name !== "string" || !b.name.trim()) {
    errors.name = ["name is required."];
  } else {
    result.name = b.name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(b, "category")) {
    if (!isNullableString(b.category)) {
      errors.category = ["category must be a string."];
    } else {
      result.category = b.category ?? null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(b, "submissionNotes")) {
    if (!isNullableString(b.submissionNotes)) {
      errors.submissionNotes = ["submissionNotes must be a string."];
    } else {
      result.submissionNotes = b.submissionNotes ?? null;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return result as ParsedAdminCreateFields;
}

export class CertificateNotPendingError extends Error {
  constructor() {
    super("Only pending certificates can be reviewed.");
  }
}

// Mirrors old CertificateController::review — only a pending certificate can
// be approved/rejected, and reviewing stamps reviewedBy/reviewedAt.
export async function reviewCertificate(
  id: bigint,
  status: Extract<CertificateStatus, "approved" | "rejected">,
  reviewerId: string
): Promise<CertificateWithCompany | null> {
  const existing = await prisma.certificate.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.status !== "pending") throw new CertificateNotPendingError();

  return prisma.certificate.update({
    where: { id },
    data: { status, reviewedBy: reviewerId, reviewedAt: new Date() },
    include: { createdByCompany: true },
  });
}
