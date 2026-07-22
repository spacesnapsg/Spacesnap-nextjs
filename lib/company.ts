import type { Company } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { invoicingCadenceForSupplierTier } from "@/lib/booking-payments";
import { getCompanySupplierTier } from "@/lib/supplier-tiers";
import { getCompanyPurchasedBalance, getCompanyEarnedBalance } from "@/lib/company-credits";
import { sgdToCredits } from "@/lib/credit-units";

// supplierTier/invoicingCadence/tierStats added 2026-07-22 (Sprint 6.10,
// supplier Financials page) — live-computed (lib/supplier-tiers.ts), not
// read off a stored column; the manual admin-set route was removed the same
// session. spendCredits is converted at this API edge only (sgdToCredits) —
// the underlying calculation stays true SGD end to end, same discipline as
// every other credits-display figure in this codebase.
//
// purchasedCredits/earnedCredits added the same day, same session
// (fulfillment follow-up) — the company-level counterpart of a user's
// wallet, see lib/company-credits.ts. Real balances, no spend flow yet
// (confirmed with the product owner).
export async function serializeCompanyDetails(company: Company) {
  const [tierStatus, purchasedBalance, earnedBalance] = await Promise.all([
    getCompanySupplierTier(company.id),
    getCompanyPurchasedBalance(company.id),
    getCompanyEarnedBalance(company.id),
  ]);

  return {
    id: company.id.toString(),
    name: company.name,
    businessName: company.businessName,
    businessDescription: company.businessDescription,
    registrationNumber: company.registrationNumber,
    financeContactEmail: company.financeContactEmail,
    financeContactPerson: company.financeContactPerson,
    supplierTier: tierStatus.tier,
    invoicingCadence: invoicingCadenceForSupplierTier(tierStatus.tier),
    tierStats: {
      averageRating: tierStatus.averageRating,
      ratingCount: tierStatus.ratingCount,
      spendCredits: sgdToCredits(tierStatus.spendSgd),
      nextTier: tierStatus.nextTier,
      progressPercent: tierStatus.progressPercent,
      baseTier: tierStatus.baseTier,
      tierBoostActive: tierStatus.tierBoostActive,
      tierBoostExpiresAt: tierStatus.tierBoostExpiresAt ? tierStatus.tierBoostExpiresAt.toISOString() : null,
    },
    purchasedCredits: sgdToCredits(Number(purchasedBalance)),
    earnedCredits: sgdToCredits(Number(earnedBalance)),
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
