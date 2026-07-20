import type { Company } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

export function serializeCompanyDetails(company: Company) {
  return {
    id: company.id.toString(),
    name: company.name,
    businessName: company.businessName,
    businessDescription: company.businessDescription,
    registrationNumber: company.registrationNumber,
    financeContactEmail: company.financeContactEmail,
    financeContactPerson: company.financeContactPerson,
  };
}

interface ParsedBusinessDetailsFields {
  businessName?: string | null;
  businessDescription?: string | null;
  registrationNumber?: string | null;
  financeContactEmail?: string | null;
  financeContactPerson?: string | null;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

// Editable subset of Company fields for the supplier profile "Business
// Details" card — deliberately not businessLocation/yearsOperating (product
// owner call, 2026-07-20) even though those columns exist. All fields
// optional/nullable — a company admin can clear a field by sending null.
export function parseBusinessDetailsFields(body: unknown): ParsedBusinessDetailsFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: ParsedBusinessDetailsFields = {};

  const fields: (keyof ParsedBusinessDetailsFields)[] = [
    "businessName",
    "businessDescription",
    "registrationNumber",
    "financeContactEmail",
    "financeContactPerson",
  ];

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(b, field)) continue;
    const value = b[field];
    if (!isNullableString(value)) {
      errors[field] = [`${field} must be a string.`];
      continue;
    }
    const trimmed = typeof value === "string" ? value.trim() : value;
    result[field] = trimmed === "" ? null : (trimmed ?? null);
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return result;
}

export async function updateCompanyBusinessDetails(
  companyId: bigint,
  fields: ParsedBusinessDetailsFields
): Promise<Company> {
  return prisma.company.update({ where: { id: companyId }, data: fields });
}
