import { ListingType, Prisma, CompanyTransactionType, type Listing } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import type { ListingRatingAggregate } from "@/lib/ratings";
import { creditsToSgd, sgdToCredits } from "@/lib/credit-units";
import { getCompanyPurchasedBalance, InsufficientCompanyPurchasedBalanceError } from "@/lib/company-credits";

// API contract uses the same field names as the Prisma model / DB columns
// (type, priceDay, priceWeek, priceMonth, pricePerUnit, stockQuantity,
// packSize) throughout — no listing_type/credits_daily/stock translation
// layer like the old Laravel API had (see CODEBASEAPI_SUMMARY.md §6,
// "naming traps"). Chosen per Sprint 3 Session 3 scope: DB-column naming,
// applied consistently, flagged here as the decision point.

const LISTING_TYPES = new Set<string>(Object.values(ListingType));

// Used only via `typeof` below, to derive ListingWithCertificates — the
// standard Prisma pattern for typing a query's `include` shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const listingWithCertificatesArgs = {
  include: { requiredCertificates: { include: { certificate: true } }, company: { select: { name: true } } },
} satisfies Prisma.ListingDefaultArgs;

export type ListingWithCertificates = Prisma.ListingGetPayload<typeof listingWithCertificatesArgs>;

export function parseBigIntParam(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

// Stored value is true SGD; the client always sees/enters the cosmetic
// "credits" unit (see lib/credit-units.ts) — converted here, once, at the
// read boundary.
function serializeDecimal(value: Listing["priceDay"]): number | null {
  return value === null ? null : sgdToCredits(Number(value));
}

export function serializeListing(
  listing: Listing | ListingWithCertificates,
  ratingAggregate?: ListingRatingAggregate
) {
  return {
    id: listing.id.toString(),
    companyId: listing.companyId.toString(),
    companyName: "company" in listing ? listing.company.name : undefined,
    averageRating: ratingAggregate?.averageRating ?? null,
    ratingCount: ratingAggregate?.ratingCount ?? 0,
    type: listing.type,
    name: listing.name,
    location: listing.location,
    description: listing.description,
    imageUrl: listing.imageUrl,
    amenities: (listing.amenities as string[] | null) ?? [],
    isAvailable: listing.isAvailable,
    requireApproval: listing.requireApproval,
    priceDay: serializeDecimal(listing.priceDay),
    priceWeek: serializeDecimal(listing.priceWeek),
    priceMonth: serializeDecimal(listing.priceMonth),
    pricePerUnit: serializeDecimal(listing.pricePerUnit),
    stockQuantity: listing.stockQuantity,
    packSize: listing.packSize,
    // Sprint 6.12 — computed, not a raw expiry check the client has to
    // redo itself (mirrors getActiveBanner's own "resolve real-world state
    // server-side" discipline). Only true when pinnedUntil is both set and
    // still in the future — an expired-but-not-yet-lazily-cleared row
    // (a narrow race between the lazy-expiry sweep and this serialize call)
    // still reports false here, never a stale true.
    isPinned: listing.pinnedUntil !== null && listing.pinnedUntil > new Date(),
    requiredCertificateIds:
      "requiredCertificates" in listing
        ? listing.requiredCertificates.map((r) => r.certificateId.toString())
        : undefined,
    requiredCertificates:
      "requiredCertificates" in listing
        ? listing.requiredCertificates.map((r) => ({
            id: r.certificate.id.toString(),
            name: r.certificate.name,
            category: r.certificate.category,
          }))
        : undefined,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

interface ParsedFields {
  name?: string;
  type?: ListingType;
  location?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  amenities?: string[];
  isAvailable?: boolean;
  requireApproval?: boolean;
  priceDay?: number | null;
  priceWeek?: number | null;
  priceMonth?: number | null;
  pricePerUnit?: number | null;
  stockQuantity?: number | null;
  packSize?: string | null;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value));
}

/**
 * Manual field-by-field validation (no schema library), matching the plain
 * style already used in app/api/auth/register/route.ts. `partial` mirrors
 * Laravel's `sometimes` rule set used by SupplierListingController::update.
 */
export function parseListingFields(body: unknown, opts: { partial: boolean }): ParsedFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: ParsedFields = {};

  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const require = (key: string) => !opts.partial || has(key);

  if (require("name")) {
    if (typeof b.name !== "string" || !b.name.trim()) {
      errors.name = ["name is required."];
    } else {
      result.name = b.name.trim();
    }
  }

  if (require("type")) {
    if (typeof b.type !== "string" || !LISTING_TYPES.has(b.type)) {
      errors.type = ["type must be one of space, equipment, consumables."];
    } else {
      result.type = b.type as ListingType;
    }
  }

  if (has("location")) {
    if (!isNullableString(b.location)) {
      errors.location = ["location must be a string."];
    } else {
      result.location = b.location ?? null;
    }
  }

  if (has("description")) {
    if (!isNullableString(b.description)) {
      errors.description = ["description must be a string."];
    } else {
      result.description = b.description ?? null;
    }
  }

  if (has("imageUrl")) {
    if (!isNullableString(b.imageUrl)) {
      errors.imageUrl = ["imageUrl must be a string."];
    } else {
      result.imageUrl = b.imageUrl ?? null;
    }
  }

  if (has("amenities")) {
    if (!Array.isArray(b.amenities) || !b.amenities.every((a) => typeof a === "string")) {
      errors.amenities = ["amenities must be an array of strings."];
    } else {
      result.amenities = b.amenities;
    }
  }

  if (has("isAvailable")) {
    if (typeof b.isAvailable !== "boolean") {
      errors.isAvailable = ["isAvailable must be a boolean."];
    } else {
      result.isAvailable = b.isAvailable;
    }
  }

  if (has("requireApproval")) {
    if (typeof b.requireApproval !== "boolean") {
      errors.requireApproval = ["requireApproval must be a boolean."];
    } else {
      result.requireApproval = b.requireApproval;
    }
  }

  for (const key of ["priceDay", "priceWeek", "priceMonth", "pricePerUnit"] as const) {
    if (has(key)) {
      const value = b[key];
      if (!isNullableNumber(value) || (typeof value === "number" && value < 0)) {
        errors[key] = [`${key} must be a non-negative number or null.`];
      } else {
        // Supplier enters/edits prices in "credits" — converted to true SGD
        // once here, at the write boundary, before it ever reaches storage
        // or the Stripe charge math downstream (see lib/credit-units.ts).
        result[key] = value === null || value === undefined ? null : creditsToSgd(value);
      }
    }
  }

  if (has("stockQuantity")) {
    const value = b.stockQuantity;
    if (!isNullableNumber(value) || (typeof value === "number" && (!Number.isInteger(value) || value < 0))) {
      errors.stockQuantity = ["stockQuantity must be a non-negative integer or null."];
    } else {
      result.stockQuantity = value ?? null;
    }
  }

  if (has("packSize")) {
    if (!isNullableString(b.packSize)) {
      errors.packSize = ["packSize must be a string."];
    } else {
      result.packSize = b.packSize ?? null;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return result;
}

interface EffectivePricing {
  type: ListingType;
  priceDay: number | null;
  priceWeek: number | null;
  priceMonth: number | null;
  pricePerUnit: number | null;
  stockQuantity: number | null;
  packSize: string | null;
}

/**
 * Resolves the effective type + pricing fields for a create/update request:
 * explicit values from the request win, otherwise fall back to the existing
 * listing's current values (unless the type itself is changing, since the
 * old type's pricing fields don't carry over). Mirrors
 * SupplierListingController::resolvePricing from the old backend.
 */
function decimalOrNull(value: Listing["priceDay"]): number | null {
  return value === null ? null : Number(value);
}

export function resolvePricing(fields: ParsedFields, existing: Listing | null): EffectivePricing {
  const type = fields.type ?? existing?.type;
  if (!type) {
    throw new ApiValidationError({ type: ["type is required."] });
  }
  // The old type's pricing fields don't carry over across a type change.
  const carryOver = existing !== null && type === existing.type;

  return {
    type,
    priceDay: fields.priceDay !== undefined ? fields.priceDay : carryOver ? decimalOrNull(existing!.priceDay) : null,
    priceWeek: fields.priceWeek !== undefined ? fields.priceWeek : carryOver ? decimalOrNull(existing!.priceWeek) : null,
    priceMonth:
      fields.priceMonth !== undefined ? fields.priceMonth : carryOver ? decimalOrNull(existing!.priceMonth) : null,
    pricePerUnit:
      fields.pricePerUnit !== undefined
        ? fields.pricePerUnit
        : carryOver
          ? decimalOrNull(existing!.pricePerUnit)
          : null,
    stockQuantity:
      fields.stockQuantity !== undefined ? fields.stockQuantity : carryOver ? existing!.stockQuantity : null,
    packSize: fields.packSize !== undefined ? fields.packSize : carryOver ? existing!.packSize : null,
  };
}

/**
 * Mirrors this repo's `listings_pricing_matches_type` CHECK constraint
 * (prisma/migrations/20260718171756_listings_pricing_check) at the app
 * layer, so a mismatch surfaces as a clean 422 instead of a raw Postgres
 * constraint-violation error. Note this rewrite's constraint requires
 * packSize for consumables (the old Laravel DB constraint did not) — see
 * the migration SQL, not the old CODEBASEAPI_SUMMARY.md §4 description.
 */
export function assertPricingMatchesType(effective: EffectivePricing): void {
  if (effective.type === "space" || effective.type === "equipment") {
    const errors: Record<string, string[]> = {};
    if (effective.priceDay === null) errors.priceDay = ["priceDay is required for space/equipment listings."];
    if (effective.priceWeek === null) errors.priceWeek = ["priceWeek is required for space/equipment listings."];
    if (effective.priceMonth === null) errors.priceMonth = ["priceMonth is required for space/equipment listings."];
    if (effective.pricePerUnit !== null) errors.pricePerUnit = ["pricePerUnit must be null for space/equipment listings."];
    if (effective.stockQuantity !== null) errors.stockQuantity = ["stockQuantity must be null for space/equipment listings."];
    if (effective.packSize !== null) errors.packSize = ["packSize must be null for space/equipment listings."];
    if (Object.keys(errors).length > 0) throw new ApiValidationError(errors);
    return;
  }

  // consumables
  const errors: Record<string, string[]> = {};
  if (effective.pricePerUnit === null) errors.pricePerUnit = ["pricePerUnit is required for consumables listings."];
  if (effective.stockQuantity === null) errors.stockQuantity = ["stockQuantity is required for consumables listings."];
  if (effective.packSize === null) errors.packSize = ["packSize is required for consumables listings."];
  if (effective.priceDay !== null) errors.priceDay = ["priceDay must be null for consumables listings."];
  if (effective.priceWeek !== null) errors.priceWeek = ["priceWeek must be null for consumables listings."];
  if (effective.priceMonth !== null) errors.priceMonth = ["priceMonth must be null for consumables listings."];
  if (Object.keys(errors).length > 0) throw new ApiValidationError(errors);
}

export async function parseRequiredCertificateIds(value: unknown): Promise<bigint[] | undefined> {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiValidationError({ requiredCertificateIds: ["requiredCertificateIds must be an array."] });
  }

  const ids: bigint[] = [];
  for (const raw of value) {
    const str = typeof raw === "number" ? String(raw) : raw;
    if (typeof str !== "string" || !/^\d+$/.test(str)) {
      throw new ApiValidationError({
        requiredCertificateIds: ["requiredCertificateIds must contain certificate ids."],
      });
    }
    ids.push(BigInt(str));
  }

  if (ids.length === 0) return [];

  const found = await prisma.certificate.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((c) => c.id.toString()));
  const missing = ids.filter((id) => !foundIds.has(id.toString()));
  if (missing.length > 0) {
    throw new ApiValidationError({
      requiredCertificateIds: [`Unknown certificate id(s): ${missing.join(", ")}.`],
    });
  }

  return ids;
}

export class ListingNotFoundError extends Error {
  constructor() {
    super("Listing not found.");
  }
}

export class NoBumpsAvailableError extends Error {
  constructor() {
    super("No Bumps available — purchase more from the Supplier Profile catalogue.");
  }
}

// Spends one Bump "ammo" on a single listing — resets boostedAt to now(),
// same effect a freshly-posted listing gets, per the product owner's own
// framing ("moves a listing to the front as if it's newly posted"). Gated
// to requireSupplier() at the route layer (any team member managing
// inventory, same gate the existing listing create/edit routes use) — the
// stricter requireCompanyAdmin gate only applies to the Bump *purchase*
// (spending shared funds), not activating one already bought.
export async function activateBump(listingId: bigint, companyId: bigint) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.companyId !== companyId) {
      throw new ListingNotFoundError();
    }

    const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
    if (company.bumpsAvailable <= 0) {
      throw new NoBumpsAvailableError();
    }

    await tx.company.update({ where: { id: companyId }, data: { bumpsAvailable: { decrement: 1 } } });
    return tx.listing.update({ where: { id: listingId }, data: { boostedAt: new Date() } });
  });
}

// Sprint 6.12 — placeholder pricing, explicitly NOT a real product-owner
// number (per the "use a random figure for now" instruction), same posture
// as BUMP_UNIT_COST_CREDITS in lib/company-credits.ts.
export const PIN_DURATION_COST_CREDITS: Record<7 | 30, number> = {
  7: 200,
  30: 600,
};

export class ListingNotAvailableError extends Error {
  constructor() {
    super("Only available listings can be pinned.");
  }
}

// Purchase and application are one combined action (per the product
// owner's own description — buy, then immediately choose which of the
// company's own active listings it applies to), unlike Bumps' separate
// buy-then-spend "ammo" flow. Re-pinning an already-pinned listing simply
// extends/restarts its window (a new pinnedAt/pinnedUntil), not an error.
export async function purchaseAndApplyPin(companyId: bigint, listingId: bigint, durationDays: 7 | 30, userId: string) {
  const cost = new Prisma.Decimal(creditsToSgd(PIN_DURATION_COST_CREDITS[durationDays])).toDecimalPlaces(2);

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.companyId !== companyId) {
      throw new ListingNotFoundError();
    }
    if (!listing.isAvailable) {
      throw new ListingNotAvailableError();
    }

    const balance = await getCompanyPurchasedBalance(companyId, tx);
    if (balance.lt(cost)) {
      throw new InsufficientCompanyPurchasedBalanceError();
    }

    await tx.companyTransaction.create({
      data: {
        companyId,
        userId,
        type: CompanyTransactionType.purchased_spend,
        amount: cost.negated(),
        description: `Pinned "${listing.name}" for ${durationDays} days`,
      },
    });

    const now = new Date();
    return tx.listing.update({
      where: { id: listingId },
      data: { pinnedAt: now, pinnedUntil: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) },
    });
  });
}
