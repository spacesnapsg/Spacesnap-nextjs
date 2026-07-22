import { Prisma } from "@/app/generated/prisma/client";
import { RewardCatalogueCategory, RewardDiscountAppliesTo } from "@/app/generated/prisma/enums";
import type { RewardCatalogueItem } from "@/app/generated/prisma/client";
import { ApiValidationError } from "@/lib/api-errors";

const CATEGORIES = Object.values(RewardCatalogueCategory);
const APPLIES_TO_VALUES = Object.values(RewardDiscountAppliesTo);

// Per-category allow-list of the customizable fields beyond the shared
// name/description/active — a field not in a row's own category's list is a
// clean 422 (parseCategoryFields below), never silently ignored or written.
const CATEGORY_FIELDS: Record<RewardCatalogueCategory, readonly string[]> = {
  discount: ["discountPercent", "discountAppliesTo"],
  pitch_ticket: ["partnerOptions"],
  consultancy: ["consultancySubject", "partnerOptions"],
  events: ["eventName", "eventInfo"],
  lucky_draw: ["prizeDescription", "prizeQuantity"],
  tier_upgrade: ["upgradeDurationMonths"],
  consumable: ["consumableName", "consumableQuantity"],
};

const ALL_CATEGORY_FIELD_KEYS = [...new Set(Object.values(CATEGORY_FIELDS).flat())] as const;

export interface RewardCategoryFieldValues {
  discountPercent?: Prisma.Decimal | null;
  discountAppliesTo?: RewardDiscountAppliesTo[];
  partnerOptions?: string[];
  consultancySubject?: string | null;
  eventName?: string | null;
  eventInfo?: string | null;
  prizeDescription?: string | null;
  prizeQuantity?: number | null;
  upgradeDurationMonths?: number | null;
  consumableName?: string | null;
  consumableQuantity?: number | null;
}

export function parseRewardCategory(value: unknown): RewardCatalogueCategory {
  if (typeof value !== "string" || !CATEGORIES.includes(value as RewardCatalogueCategory)) {
    throw new ApiValidationError({ category: [`category must be one of: ${CATEGORIES.join(", ")}.`] });
  }
  return value as RewardCatalogueCategory;
}

function parseText(value: unknown, field: string, { required }: { required: boolean }): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) {
    if (required) throw new ApiValidationError({ [field]: [`${field} is required.`] });
    return null;
  }
  if (typeof value !== "string" || (required && value.trim().length === 0)) {
    throw new ApiValidationError({ [field]: [`${field} must be a non-empty string.`] });
  }
  return value.trim();
}

function parsePositiveInt(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ApiValidationError({ [field]: [`${field} must be a whole number of at least 1.`] });
  }
  return value;
}

function parsePercent(value: unknown): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
    throw new ApiValidationError({ discountPercent: ["discountPercent must be a number between 0 and 100."] });
  }
  return new Prisma.Decimal(value);
}

// Universal to every category — how many earned credits a redemption costs.
// Unlike the category-specific fields above, this always applies, so it's
// parsed/validated separately from parseCategoryFields.
export function parseCreditCost(value: unknown): Prisma.Decimal | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ApiValidationError({ creditCost: ["creditCost must be a number of 0 or more."] });
  }
  return new Prisma.Decimal(value);
}

// null = unlimited (no cap on how many times this item can be redeemed).
export function parseQuantityAvailable(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ApiValidationError({ quantityAvailable: ["quantityAvailable must be a whole number of 0 or more, or null for unlimited."] });
  }
  return value;
}

// Display-only for now — see RewardCatalogueItem's own schema comment: no
// redemption flow exists anywhere yet, so redeemedCount can never actually
// increment. This just computes what "fully redeemed" would mean once one
// does.
export function isFullyRedeemed(item: Pick<RewardCatalogueItem, "quantityAvailable" | "redeemedCount">): boolean {
  return item.quantityAvailable !== null && item.redeemedCount >= item.quantityAvailable;
}

function parseAppliesTo(value: unknown): RewardDiscountAppliesTo[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !APPLIES_TO_VALUES.includes(v as RewardDiscountAppliesTo))) {
    throw new ApiValidationError({
      discountAppliesTo: [`discountAppliesTo must be an array made up of: ${APPLIES_TO_VALUES.join(", ")}.`],
    });
  }
  return value as RewardDiscountAppliesTo[];
}

// category: pitch_ticket + consultancy — the list of partners a user can
// choose from at redemption time (RewardRedemption.selectedPartnerOption).
// Blank entries are dropped rather than rejected outright, same leniency as
// every other optional text field here — an admin saving with an empty row
// mid-edit shouldn't 422.
function parsePartnerOptions(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new ApiValidationError({ partnerOptions: ["partnerOptions must be an array of strings."] });
  }
  return value.map((v) => v.trim()).filter((v) => v.length > 0);
}

// Validates that `body` only contains fields belonging to `category`
// (per CATEGORY_FIELDS above), parses/validates each present field, and
// returns the Prisma-ready values — nulling out every field NOT in this
// category's allow-list isn't done here (see clearedFieldsForCategory,
// used only on a category change in the PATCH route) since a plain
// create/update with no category change should leave untouched fields alone.
export function parseCategoryFields(category: RewardCatalogueCategory, body: Record<string, unknown>): RewardCategoryFieldValues {
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
    discountPercent: parsePercent(body.discountPercent),
    discountAppliesTo: parseAppliesTo(body.discountAppliesTo),
    partnerOptions: parsePartnerOptions(body.partnerOptions),
    consultancySubject: parseText(body.consultancySubject, "consultancySubject", { required: false }),
    eventName: parseText(body.eventName, "eventName", { required: false }),
    eventInfo: parseText(body.eventInfo, "eventInfo", { required: false }),
    prizeDescription: parseText(body.prizeDescription, "prizeDescription", { required: false }),
    prizeQuantity: parsePositiveInt(body.prizeQuantity, "prizeQuantity"),
    upgradeDurationMonths: parsePositiveInt(body.upgradeDurationMonths, "upgradeDurationMonths"),
    consumableName: parseText(body.consumableName, "consumableName", { required: false }),
    consumableQuantity: parsePositiveInt(body.consumableQuantity, "consumableQuantity"),
  };
}

// Used only when a PATCH changes an item's category — nulls out every field
// that belonged to the OLD category and isn't valid for the new one, so a
// row never carries stale cross-category data (e.g. a former discount that
// became a consumable keeps a dangling discountPercent).
export function clearedFieldsForCategory(newCategory: RewardCatalogueCategory): Partial<RewardCategoryFieldValues> {
  const allowed = new Set(CATEGORY_FIELDS[newCategory]);
  const cleared: Partial<RewardCategoryFieldValues> = {};
  for (const key of ALL_CATEGORY_FIELD_KEYS) {
    if (!allowed.has(key)) {
      (cleared as Record<string, unknown>)[key] = key === "discountAppliesTo" || key === "partnerOptions" ? [] : null;
    }
  }
  return cleared;
}

export function serializeRewardCatalogueItem(item: RewardCatalogueItem) {
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
    discountPercent: item.discountPercent ? Number(item.discountPercent) : null,
    discountAppliesTo: item.discountAppliesTo,
    partnerOptions: item.partnerOptions,
    consultancySubject: item.consultancySubject,
    eventName: item.eventName,
    eventInfo: item.eventInfo,
    prizeDescription: item.prizeDescription,
    prizeQuantity: item.prizeQuantity,
    upgradeDurationMonths: item.upgradeDurationMonths,
    consumableName: item.consumableName,
    consumableQuantity: item.consumableQuantity,
  };
}
