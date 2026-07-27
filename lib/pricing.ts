import { Prisma, BookingType, type PlatformPricingConfig } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

// Admin-controlled, per-supplier pricing & commission (2026-07-24, financial
// audit F2 follow-on). Two layers:
//   - PlatformPricingConfig: the platform-wide defaults (single row, id 1).
//   - Company.*Percent overrides: nullable per-company values an admin can set
//     that win over the default. Suppliers never set either.
// getEffectiveCompanyPricing merges them; every rate is snapshotted onto a
// Booking / consumable payable at charge time (see createBookingWithDebit,
// lib/bookings.ts; createConsumablePayable, lib/supplier-payables.ts), never
// read live afterward, so a later rate change can't reshuffle a settled row.

// The five configurable rates, resolved for a specific company (override ??
// platform default). Percentages as whole numbers (e.g. 50 = 50%, 10 = 10%).
export interface EffectivePricing {
  bookingMarkupDailyPercent: Prisma.Decimal;
  bookingMarkupWeeklyPercent: Prisma.Decimal;
  bookingMarkupMonthlyPercent: Prisma.Decimal;
  bookingCommissionPercent: Prisma.Decimal;
  consumablesCommissionPercent: Prisma.Decimal;
}

const CONFIG_FIELDS = [
  "bookingMarkupDailyPercent",
  "bookingMarkupWeeklyPercent",
  "bookingMarkupMonthlyPercent",
  "bookingCommissionPercent",
  "consumablesCommissionPercent",
] as const;
type ConfigField = (typeof CONFIG_FIELDS)[number];

// Markup can exceed 100% (a 150% marketplace markup is base × 2.5); commission
// is a share of a price and must stay within 0–100.
const IS_COMMISSION_FIELD: Record<ConfigField, boolean> = {
  bookingMarkupDailyPercent: false,
  bookingMarkupWeeklyPercent: false,
  bookingMarkupMonthlyPercent: false,
  bookingCommissionPercent: true,
  consumablesCommissionPercent: true,
};

// Reads the platform defaults singleton, creating it with schema defaults on
// the (post-migration, essentially never) chance it's missing — same lazy
// self-heal idiom as other "should always exist" singletons in this codebase.
export async function getPlatformPricingConfig(
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PlatformPricingConfig> {
  const existing = await client.platformPricingConfig.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return client.platformPricingConfig.create({ data: { id: 1 } });
}

// Nullable override shape shared by getEffectiveCompanyPricing and its batched
// map sibling — every per-company override column, any of which may be null.
type CompanyOverrides = {
  bookingMarkupDailyPercent: Prisma.Decimal | null;
  bookingMarkupWeeklyPercent: Prisma.Decimal | null;
  bookingMarkupMonthlyPercent: Prisma.Decimal | null;
  bookingCommissionPercent: Prisma.Decimal | null;
  consumablesCommissionPercent: Prisma.Decimal | null;
};

const OVERRIDE_SELECT = {
  bookingMarkupDailyPercent: true,
  bookingMarkupWeeklyPercent: true,
  bookingMarkupMonthlyPercent: true,
  bookingCommissionPercent: true,
  consumablesCommissionPercent: true,
} as const;

function mergePricing(config: PlatformPricingConfig, overrides: CompanyOverrides | null | undefined): EffectivePricing {
  return {
    bookingMarkupDailyPercent: overrides?.bookingMarkupDailyPercent ?? config.bookingMarkupDailyPercent,
    bookingMarkupWeeklyPercent: overrides?.bookingMarkupWeeklyPercent ?? config.bookingMarkupWeeklyPercent,
    bookingMarkupMonthlyPercent: overrides?.bookingMarkupMonthlyPercent ?? config.bookingMarkupMonthlyPercent,
    bookingCommissionPercent: overrides?.bookingCommissionPercent ?? config.bookingCommissionPercent,
    consumablesCommissionPercent: overrides?.consumablesCommissionPercent ?? config.consumablesCommissionPercent,
  };
}

// Merges a company's nullable overrides over the platform defaults. A missing
// company (shouldn't happen for a real listing) falls back to pure defaults.
export async function getEffectiveCompanyPricing(
  companyId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<EffectivePricing> {
  const [config, company] = await Promise.all([
    getPlatformPricingConfig(client),
    client.company.findUnique({ where: { id: companyId }, select: OVERRIDE_SELECT }),
  ]);
  return mergePricing(config, company);
}

// Batched resolver for a marketplace list spanning many companies — one config
// read + one company query, not N per listing. Keyed by companyId string.
export async function getEffectiveCompanyPricingMap(companyIds: bigint[]): Promise<Map<string, EffectivePricing>> {
  const config = await getPlatformPricingConfig();
  const uniqueIds = [...new Set(companyIds.map((id) => id.toString()))].map((s) => BigInt(s));
  const companies = uniqueIds.length
    ? await prisma.company.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, ...OVERRIDE_SELECT } })
    : [];
  const byId = new Map(companies.map((c) => [c.id.toString(), c]));
  const result = new Map<string, EffectivePricing>();
  for (const id of uniqueIds) {
    result.set(id.toString(), mergePricing(config, byId.get(id.toString())));
  }
  return result;
}

export function markupPercentForBookingType(pricing: EffectivePricing, type: BookingType): Prisma.Decimal {
  switch (type) {
    case BookingType.daily:
      return pricing.bookingMarkupDailyPercent;
    case BookingType.weekly:
      return pricing.bookingMarkupWeeklyPercent;
    case BookingType.monthly:
      return pricing.bookingMarkupMonthlyPercent;
  }
}

// The marketplace price a member is charged: the supplier's base price marked
// up by the booking-type markup. base × (1 + markup%/100), rounded to cents.
export function applyMarkup(base: Prisma.Decimal, markupPercent: Prisma.Decimal): Prisma.Decimal {
  return base.mul(markupPercent.div(100).add(1)).toDecimalPlaces(2);
}

// What the supplier is paid for a booking: (100 - commission%)% of their BASE
// price — deliberately NOT of the marked-up sgdAmount. The whole markup plus
// the commission slice of the base is SpaceSnap's.
export function supplierGrossForBase(base: Prisma.Decimal, commissionPercent: Prisma.Decimal): Prisma.Decimal {
  return base.mul(new Prisma.Decimal(100).sub(commissionPercent).div(100)).toDecimalPlaces(2);
}

// SpaceSnap's cut of a completed booking = marketplace price − supplier gross
// (= the markup + commission% of base). This is the figure persisted as
// SupplierPayable.commissionAmount and the base the supplier-decline penalty
// is sized against.
export function platformCommissionForBooking(
  sgdAmount: Prisma.Decimal,
  base: Prisma.Decimal,
  commissionPercent: Prisma.Decimal
): Prisma.Decimal {
  return sgdAmount.sub(supplierGrossForBase(base, commissionPercent)).toDecimalPlaces(2);
}

// What the supplier is paid for a consumable sale: (100 - commission%)% of the
// amount the member paid (its RSP × qty — consumables carry no markup).
export function supplierGrossForConsumable(charged: Prisma.Decimal, commissionPercent: Prisma.Decimal): Prisma.Decimal {
  return charged.mul(new Prisma.Decimal(100).sub(commissionPercent).div(100)).toDecimalPlaces(2);
}

// Shared parse/validate for a rate field — a number (or numeric string) in the
// allowed range for its kind. Returns a Decimal, or records an error.
function parsePercent(
  raw: unknown,
  field: ConfigField,
  errors: Record<string, string[]>
): Prisma.Decimal | undefined {
  if (raw === undefined) return undefined;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0) {
    errors[field] = ["Must be a number of at least 0."];
    return undefined;
  }
  if (IS_COMMISSION_FIELD[field] && n > 100) {
    errors[field] = ["A commission percentage cannot exceed 100."];
    return undefined;
  }
  if (n > 100000) {
    errors[field] = ["This value is too large."];
    return undefined;
  }
  return new Prisma.Decimal(n);
}

// Admin-only. Updates any subset of the platform defaults; omitted fields are
// left as-is.
export async function updatePlatformPricingConfig(input: Record<string, unknown>): Promise<PlatformPricingConfig> {
  const errors: Record<string, string[]> = {};
  const data: Record<string, Prisma.Decimal> = {};
  for (const field of CONFIG_FIELDS) {
    const value = parsePercent(input[field], field, errors);
    if (value !== undefined) data[field] = value;
  }
  if (Object.keys(errors).length > 0) throw new ApiValidationError(errors);

  await getPlatformPricingConfig();
  return prisma.platformPricingConfig.update({ where: { id: 1 }, data });
}

// Admin-only. Sets/clears a company's per-field overrides. An explicit null
// clears an override (reverting that field to the platform default); an
// omitted field is left unchanged.
export async function updateCompanyPricingOverrides(
  companyId: bigint,
  input: Record<string, unknown>
): Promise<void> {
  const errors: Record<string, string[]> = {};
  const data: Record<string, Prisma.Decimal | null> = {};
  for (const field of CONFIG_FIELDS) {
    if (!(field in input)) continue;
    if (input[field] === null) {
      data[field] = null;
      continue;
    }
    const value = parsePercent(input[field], field, errors);
    if (value !== undefined) data[field] = value;
  }
  if (Object.keys(errors).length > 0) throw new ApiValidationError(errors);
  if (Object.keys(data).length === 0) return;

  await prisma.company.update({ where: { id: companyId }, data });
}

function toNum(d: Prisma.Decimal): number {
  return Number(d);
}

const COMPANY_PRICING_SELECT = {
  id: true,
  name: true,
  bookingMarkupDailyPercent: true,
  bookingMarkupWeeklyPercent: true,
  bookingMarkupMonthlyPercent: true,
  bookingCommissionPercent: true,
  consumablesCommissionPercent: true,
} satisfies Prisma.CompanySelect;

type CompanyPricingRow = Prisma.CompanyGetPayload<{ select: typeof COMPANY_PRICING_SELECT }>;

function shapeCompanyPricingRow(c: CompanyPricingRow, config: PlatformPricingConfig) {
  const overrides: Record<ConfigField, number | null> = {
    bookingMarkupDailyPercent: c.bookingMarkupDailyPercent === null ? null : toNum(c.bookingMarkupDailyPercent),
    bookingMarkupWeeklyPercent: c.bookingMarkupWeeklyPercent === null ? null : toNum(c.bookingMarkupWeeklyPercent),
    bookingMarkupMonthlyPercent: c.bookingMarkupMonthlyPercent === null ? null : toNum(c.bookingMarkupMonthlyPercent),
    bookingCommissionPercent: c.bookingCommissionPercent === null ? null : toNum(c.bookingCommissionPercent),
    consumablesCommissionPercent: c.consumablesCommissionPercent === null ? null : toNum(c.consumablesCommissionPercent),
  };
  const effective: Record<ConfigField, number> = {
    bookingMarkupDailyPercent: overrides.bookingMarkupDailyPercent ?? toNum(config.bookingMarkupDailyPercent),
    bookingMarkupWeeklyPercent: overrides.bookingMarkupWeeklyPercent ?? toNum(config.bookingMarkupWeeklyPercent),
    bookingMarkupMonthlyPercent: overrides.bookingMarkupMonthlyPercent ?? toNum(config.bookingMarkupMonthlyPercent),
    bookingCommissionPercent: overrides.bookingCommissionPercent ?? toNum(config.bookingCommissionPercent),
    consumablesCommissionPercent: overrides.consumablesCommissionPercent ?? toNum(config.consumablesCommissionPercent),
  };
  return { companyId: c.id.toString(), companyName: c.name, overrides, effective };
}

// Admin-only. Every company with both its raw overrides (null = inheriting
// the default) and the resolved effective rates, for the per-supplier pricing
// table in the admin panel.
const COMPANY_PRICING_PER_PAGE = 10;

// search/page added 2026-07-27 (admin UI request — the per-supplier override
// table has no bound on company count, same "will get crazy as it grows"
// concern as the admin/users list, which already established this
// search+skip/take pattern (app/api/admin/users/route.ts).
export async function listCompanyPricingOverrides(options: { search?: string; page?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.CompanyWhereInput = options.search
    ? { name: { contains: options.search, mode: "insensitive" } }
    : {};

  const [config, companies, total] = await Promise.all([
    getPlatformPricingConfig(),
    prisma.company.findMany({
      where,
      select: COMPANY_PRICING_SELECT,
      orderBy: { name: "asc" },
      skip: (page - 1) * COMPANY_PRICING_PER_PAGE,
      take: COMPANY_PRICING_PER_PAGE,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    companies: companies.map((c) => shapeCompanyPricingRow(c, config)),
    meta: { page, perPage: COMPANY_PRICING_PER_PAGE, total },
  };
}

// Admin-only. Single-company lookup, same shape as one row of
// listCompanyPricingOverrides — used after a PATCH to return the just-updated
// company without depending on which search/page it would land on in the
// paginated list (app/api/admin/pricing/companies/[id]/route.ts).
export async function getCompanyPricingOverride(companyId: bigint) {
  const [config, company] = await Promise.all([
    getPlatformPricingConfig(),
    prisma.company.findUnique({ where: { id: companyId }, select: COMPANY_PRICING_SELECT }),
  ]);
  return company ? shapeCompanyPricingRow(company, config) : null;
}

export function serializePlatformPricingConfig(config: PlatformPricingConfig) {
  return {
    bookingMarkupDailyPercent: toNum(config.bookingMarkupDailyPercent),
    bookingMarkupWeeklyPercent: toNum(config.bookingMarkupWeeklyPercent),
    bookingMarkupMonthlyPercent: toNum(config.bookingMarkupMonthlyPercent),
    bookingCommissionPercent: toNum(config.bookingCommissionPercent),
    consumablesCommissionPercent: toNum(config.consumablesCommissionPercent),
    updatedAt: config.updatedAt.toISOString(),
  };
}
