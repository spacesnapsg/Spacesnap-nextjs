import { Prisma, CompanyTransactionType, type BoostProduct, type BoostProductBuiltinEffect } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { creditsToSgd } from "@/lib/credit-units";
import { getCompanyPurchasedBalance, InsufficientCompanyPurchasedBalanceError } from "@/lib/company-credits";

// The "Boost Your Listings" catalogue (components/ListingBoostCatalogueCard.tsx)
// — see BoostProduct's own schema comment for the builtin-vs-custom split.
// This module is the parse/serialize/purchase layer, same role
// lib/reward-catalogue.ts plays for the Rewards catalogue.

export const BOOST_PRODUCT_ICON_NAMES = ["zap", "pin", "file-text", "megaphone", "mail", "star", "tag"] as const;
export type BoostProductIconName = (typeof BOOST_PRODUCT_ICON_NAMES)[number];

export class BoostProductNotFoundError extends Error {
  constructor() {
    super("Boost product not found.");
  }
}

export class BuiltinBoostProductNotDeletableError extends Error {
  constructor() {
    super("Bumps and Pin can only be deactivated, not deleted.");
  }
}

export class BoostProductInactiveError extends Error {
  constructor() {
    super("This product is not currently available for purchase.");
  }
}

// The generic purchase route only ever handles builtinEffect "none" rows —
// Bumps/Pin keep their own dedicated purchase functions (purchaseBumps,
// purchaseAndApplyPin) since buying them does something specific beyond a
// credit deduction (an "ammo" counter / a listing's pin duration).
export class BoostProductNotPurchasableHereError extends Error {
  constructor() {
    super("This product has its own dedicated purchase flow.");
  }
}

function parseIconName(value: unknown): BoostProductIconName {
  if (value === undefined) return "star";
  if (typeof value !== "string" || !(BOOST_PRODUCT_ICON_NAMES as readonly string[]).includes(value)) {
    throw new ApiValidationError({ iconName: [`iconName must be one of: ${BOOST_PRODUCT_ICON_NAMES.join(", ")}.`] });
  }
  return value as BoostProductIconName;
}

function parseText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiValidationError({ [field]: [`${field} is required.`] });
  }
  return value.trim();
}

function parsePriceCredits(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ApiValidationError({ [field]: [`${field} must be a whole number of at least 1.`] });
  }
  return value;
}

export function parsePurchaseQuantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ApiValidationError({ quantity: ["quantity must be an integer of at least 1."] });
  }
  return value;
}

// POST /api/admin/boost-products always creates a builtinEffect "none" row
// — Bump/Pin are seeded once by the migration, never admin-created (see
// BoostProduct's schema comment for why: their purchase code assumes
// exactly one row of each exists).
export interface BoostProductCreateFields {
  name: string;
  description: string;
  iconName: BoostProductIconName;
  priceCredits: number;
  active: boolean;
}

export function parseBoostProductCreateFields(body: Record<string, unknown>): BoostProductCreateFields {
  if (body.builtinEffect !== undefined) {
    throw new ApiValidationError({ builtinEffect: ["New products are always custom — builtinEffect cannot be set."] });
  }
  return {
    name: parseText(body.name, "name"),
    description: parseText(body.description, "description"),
    iconName: parseIconName(body.iconName),
    priceCredits: parsePriceCredits(body.priceCredits, "priceCredits"),
    active: typeof body.active === "boolean" ? body.active : true,
  };
}

export interface BoostProductUpdateFields {
  name?: string;
  description?: string;
  iconName?: BoostProductIconName;
  active?: boolean;
  priceCredits?: number;
  pin7PriceCredits?: number;
  pin30PriceCredits?: number;
}

// PATCH — name/description/iconName/active always editable; price fields
// are gated by the row's OWN builtinEffect (it never changes post-creation),
// same "reject fields that don't apply" discipline as reward-catalogue's
// clearedFieldsForCategory.
export function parseBoostProductUpdateFields(builtinEffect: BoostProductBuiltinEffect, body: Record<string, unknown>): BoostProductUpdateFields {
  const fields: BoostProductUpdateFields = {};

  if (body.name !== undefined) fields.name = parseText(body.name, "name");
  if (body.description !== undefined) fields.description = parseText(body.description, "description");
  if (body.iconName !== undefined) fields.iconName = parseIconName(body.iconName);
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") throw new ApiValidationError({ active: ["active must be a boolean."] });
    fields.active = body.active;
  }

  const disallowed: Record<string, string[]> = {};
  if (builtinEffect === "pin") {
    if (body.priceCredits !== undefined) disallowed.priceCredits = ["priceCredits does not apply to Pin — use pin7PriceCredits/pin30PriceCredits."];
    if (body.pin7PriceCredits !== undefined) fields.pin7PriceCredits = parsePriceCredits(body.pin7PriceCredits, "pin7PriceCredits");
    if (body.pin30PriceCredits !== undefined) fields.pin30PriceCredits = parsePriceCredits(body.pin30PriceCredits, "pin30PriceCredits");
  } else {
    if (body.pin7PriceCredits !== undefined) disallowed.pin7PriceCredits = ["pin7PriceCredits only applies to Pin."];
    if (body.pin30PriceCredits !== undefined) disallowed.pin30PriceCredits = ["pin30PriceCredits only applies to Pin."];
    if (body.priceCredits !== undefined) fields.priceCredits = parsePriceCredits(body.priceCredits, "priceCredits");
  }
  if (Object.keys(disallowed).length > 0) throw new ApiValidationError(disallowed);

  return fields;
}

export function assertDeletable(product: Pick<BoostProduct, "builtinEffect">): void {
  if (product.builtinEffect !== "none") {
    throw new BuiltinBoostProductNotDeletableError();
  }
}

export function serializeBoostProduct(item: BoostProduct) {
  return {
    id: item.id.toString(),
    builtinEffect: item.builtinEffect,
    name: item.name,
    description: item.description,
    iconName: item.iconName,
    active: item.active,
    sortOrder: item.sortOrder,
    priceCredits: item.priceCredits,
    pin7PriceCredits: item.pin7PriceCredits,
    pin30PriceCredits: item.pin30PriceCredits,
  };
}

type Db = typeof prisma | Prisma.TransactionClient;

// New custom products sort after everything that already exists (Bumps/Pin
// seeded at 0/1), so admin additions always land at the end of the
// catalogue without needing a sortOrder field in the Add Product form.
export async function computeNextSortOrder(client: Db = prisma): Promise<number> {
  const top = await client.boostProduct.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (top?.sortOrder ?? -1) + 1;
}

export async function getBuiltinBoostProduct(effect: "bump" | "pin", client: Db = prisma): Promise<BoostProduct> {
  const product = await client.boostProduct.findFirst({ where: { builtinEffect: effect } });
  if (!product) throw new BoostProductNotFoundError();
  if (!product.active) throw new BoostProductInactiveError();
  return product;
}

// Thin wrappers so purchaseBumps/purchaseAndApplyPin (and their own test
// suites) read the live seeded price instead of a compile-time constant —
// replaces the old BUMP_UNIT_COST_CREDITS/PIN_DURATION_COST_CREDITS.
export async function getBumpUnitPriceCredits(client: Db = prisma): Promise<number> {
  const product = await getBuiltinBoostProduct("bump", client);
  return product.priceCredits!;
}

export async function getPinDurationPriceCredits(client: Db = prisma): Promise<Record<7 | 30, number>> {
  const product = await getBuiltinBoostProduct("pin", client);
  return { 7: product.pin7PriceCredits!, 30: product.pin30PriceCredits! };
}

// Generic purchase for a builtinEffect "none" product — a plain per-unit
// credit deduction with no automated inventory effect (no counter to
// increment, unlike Bumps' bumpsAvailable). The CompanyTransaction row
// written here IS the sale/revenue record; there's no further "someone
// needs to fulfill this" step in the app — delivering whatever the product
// represents (a report, an ad slot, ...) happens outside it, same posture
// as purchaseBumps/purchaseAndApplyPin not notifying anyone either.
export async function purchaseBoostProduct(companyId: bigint, productId: bigint, quantity: number, userId: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.boostProduct.findUnique({ where: { id: productId } });
    if (!product) throw new BoostProductNotFoundError();
    if (product.builtinEffect !== "none") throw new BoostProductNotPurchasableHereError();
    if (!product.active) throw new BoostProductInactiveError();

    const cost = new Prisma.Decimal(creditsToSgd(quantity * product.priceCredits!)).toDecimalPlaces(2);
    const balance = await getCompanyPurchasedBalance(companyId, tx);
    if (balance.lt(cost)) throw new InsufficientCompanyPurchasedBalanceError();

    await tx.companyTransaction.create({
      data: {
        companyId,
        userId,
        type: CompanyTransactionType.purchased_spend,
        amount: cost.negated(),
        description: `Purchased ${quantity}x ${product.name}`,
      },
    });

    return { product, quantity };
  });
}
