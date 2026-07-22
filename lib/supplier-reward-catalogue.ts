import { Prisma } from "@/app/generated/prisma/client";
import { SupplierRewardCategory, SupplierReportTargetGroup } from "@/app/generated/prisma/enums";
import type { SupplierRewardCatalogueItem } from "@/app/generated/prisma/client";
import { ApiValidationError } from "@/lib/api-errors";

const CATEGORIES = Object.values(SupplierRewardCategory);
const TARGET_GROUP_VALUES = Object.values(SupplierReportTargetGroup);

// Per-category allow-list, same discipline as lib/reward-catalogue.ts's own
// CATEGORY_FIELDS — a field not in a row's own category's list is a clean
// 422, never silently ignored or written.
const CATEGORY_FIELDS: Record<SupplierRewardCategory, readonly string[]> = {
  report: ["reportTargetGroups"],
  ad: ["campaignDurationDays"],
  system: ["upgradeDurationMonths"],
};

const ALL_CATEGORY_FIELD_KEYS = [...new Set(Object.values(CATEGORY_FIELDS).flat())] as const;

export interface SupplierRewardCategoryFieldValues {
  reportTargetGroups?: SupplierReportTargetGroup[];
  campaignDurationDays?: number | null;
  upgradeDurationMonths?: number | null;
}

export function parseSupplierRewardCategory(value: unknown): SupplierRewardCategory {
  if (typeof value !== "string" || !CATEGORIES.includes(value as SupplierRewardCategory)) {
    throw new ApiValidationError({ category: [`category must be one of: ${CATEGORIES.join(", ")}.`] });
  }
  return value as SupplierRewardCategory;
}

function parsePositiveInt(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ApiValidationError({ [field]: [`${field} must be a whole number of at least 1.`] });
  }
  return value;
}

function parseTargetGroups(value: unknown): SupplierReportTargetGroup[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !TARGET_GROUP_VALUES.includes(v as SupplierReportTargetGroup))) {
    throw new ApiValidationError({
      reportTargetGroups: [`reportTargetGroups must be an array made up of: ${TARGET_GROUP_VALUES.join(", ")}.`],
    });
  }
  return value as SupplierReportTargetGroup[];
}

// Universal to every category — how many company earned credits a redemption
// costs. Parsed separately from parseCategoryFields, same split as
// lib/reward-catalogue.ts's parseCreditCost.
export function parseCreditCost(value: unknown): Prisma.Decimal | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ApiValidationError({ creditCost: ["creditCost must be a number of 0 or more."] });
  }
  return new Prisma.Decimal(value);
}

// null = unlimited.
export function parseQuantityAvailable(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ApiValidationError({ quantityAvailable: ["quantityAvailable must be a whole number of 0 or more, or null for unlimited."] });
  }
  return value;
}

export function isFullyRedeemed(item: Pick<SupplierRewardCatalogueItem, "quantityAvailable" | "redeemedCount">): boolean {
  return item.quantityAvailable !== null && item.redeemedCount >= item.quantityAvailable;
}

// Validates that `body` only contains fields belonging to `category` (per
// CATEGORY_FIELDS above), parses/validates each present field, and returns
// the Prisma-ready values. Nulling out fields NOT in this category's
// allow-list isn't done here (see clearedFieldsForCategory, used only on a
// category change in the PATCH route).
export function parseCategoryFields(category: SupplierRewardCategory, body: Record<string, unknown>): SupplierRewardCategoryFieldValues {
  const allowed = new Set(CATEGORY_FIELDS[category]);
  const disallowedPresent = ALL_CATEGORY_FIELD_KEYS.filter((key) => key in body && !allowed.has(key));
  if (disallowedPresent.length > 0) {
    const errors: Record<string, string[]> = {};
    for (const key of disallowedPresent) {
      errors[key] = [`${key} does not apply to the "${category}" category.`];
    }
    throw new ApiValidationError(errors);
  }

  return {
    reportTargetGroups: parseTargetGroups(body.reportTargetGroups),
    campaignDurationDays: parsePositiveInt(body.campaignDurationDays, "campaignDurationDays"),
    upgradeDurationMonths: parsePositiveInt(body.upgradeDurationMonths, "upgradeDurationMonths"),
  };
}

// Used only when a PATCH changes an item's category — nulls out every field
// that belonged to the OLD category and isn't valid for the new one.
export function clearedFieldsForCategory(newCategory: SupplierRewardCategory): Partial<SupplierRewardCategoryFieldValues> {
  const allowed = new Set(CATEGORY_FIELDS[newCategory]);
  const cleared: Partial<SupplierRewardCategoryFieldValues> = {};
  for (const key of ALL_CATEGORY_FIELD_KEYS) {
    if (!allowed.has(key)) {
      (cleared as Record<string, unknown>)[key] = key === "reportTargetGroups" ? [] : null;
    }
  }
  return cleared;
}

export function serializeSupplierRewardCatalogueItem(item: SupplierRewardCatalogueItem) {
  return {
    id: item.id.toString(),
    category: item.category,
    name: item.name,
    description: item.description,
    active: item.active,
    creditCost: Number(item.creditCost),
    quantityAvailable: item.quantityAvailable,
    redeemedCount: item.redeemedCount,
    fullyRedeemed: isFullyRedeemed(item),
    reportTargetGroups: item.reportTargetGroups,
    campaignDurationDays: item.campaignDurationDays,
    upgradeDurationMonths: item.upgradeDurationMonths,
  };
}
