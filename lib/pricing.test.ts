// Coverage for admin-controlled, per-supplier pricing & commission (financial
// audit F2 follow-on, 2026-07-24). Pure markup/commission math plus the
// platform-default / per-company-override resolution. Hits the real dev
// Postgres DB (same convention as lib/supplier-payables.test.ts) for the
// config/override resolvers.
import "dotenv/config";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingType, Prisma } from "../app/generated/prisma/client";
import {
  getPlatformPricingConfig,
  getEffectiveCompanyPricing,
  updateCompanyPricingOverrides,
  markupPercentForBookingType,
  applyMarkup,
  supplierGrossForBase,
  platformCommissionForBooking,
  supplierGrossForConsumable,
  listCompanyPricingOverrides,
  getCompanyPricingOverride,
} from "./pricing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const D = (n: number | string) => new Prisma.Decimal(n);

let n = 0;
async function createCompany() {
  n += 1;
  return prisma.company.create({ data: { name: `Pricing Test Co ${Date.now()}-${n}` } });
}

describe("pricing math", () => {
  // The product owner's own worked example: base 100 daily → member pays 150,
  // supplier gets 90, SpaceSnap keeps 60.
  test("daily: base 100 @ 50% markup / 10% commission → 150 / 90 / 60", () => {
    const charged = applyMarkup(D(100), D(50));
    const supplier = supplierGrossForBase(D(100), D(10));
    const platform = platformCommissionForBooking(charged, D(100), D(10));
    assert.equal(charged.toString(), "150");
    assert.equal(supplier.toString(), "90");
    assert.equal(platform.toString(), "60");
    // Reconciliation identity: what the member paid = supplier + platform.
    assert.equal(supplier.add(platform).toString(), charged.toString());
  });

  test("weekly 30% and monthly 20% markups, supplier always 90% of base", () => {
    assert.equal(applyMarkup(D(100), D(30)).toString(), "130");
    assert.equal(platformCommissionForBooking(D(130), D(100), D(10)).toString(), "40");
    assert.equal(applyMarkup(D(100), D(20)).toString(), "120");
    assert.equal(platformCommissionForBooking(D(120), D(100), D(10)).toString(), "30");
  });

  test("consumables: no markup, supplier keeps 93% of RSP at 7% commission", () => {
    assert.equal(supplierGrossForConsumable(D(100), D(7)).toString(), "93");
    assert.equal(supplierGrossForConsumable(D(49.99), D(7)).toString(), "46.49");
  });
});

describe("effective pricing resolution", () => {
  test("platform defaults are 50/30/20 markup, 10 booking, 7 consumables", async () => {
    const config = await getPlatformPricingConfig();
    assert.equal(Number(config.bookingMarkupDailyPercent), 50);
    assert.equal(Number(config.bookingMarkupWeeklyPercent), 30);
    assert.equal(Number(config.bookingMarkupMonthlyPercent), 20);
    assert.equal(Number(config.bookingCommissionPercent), 10);
    assert.equal(Number(config.consumablesCommissionPercent), 7);
  });

  test("a company with no overrides inherits every default", async () => {
    const company = await createCompany();
    try {
      const p = await getEffectiveCompanyPricing(company.id);
      assert.equal(Number(markupPercentForBookingType(p, BookingType.daily)), 50);
      assert.equal(Number(p.bookingCommissionPercent), 10);
      assert.equal(Number(p.consumablesCommissionPercent), 7);
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });

  test("an admin override wins; null reverts that field to the default", async () => {
    const company = await createCompany();
    try {
      await updateCompanyPricingOverrides(company.id, { bookingCommissionPercent: 15, bookingMarkupDailyPercent: 80 });
      let p = await getEffectiveCompanyPricing(company.id);
      assert.equal(Number(p.bookingCommissionPercent), 15);
      assert.equal(Number(markupPercentForBookingType(p, BookingType.daily)), 80);
      // Untouched field still inherits.
      assert.equal(Number(p.consumablesCommissionPercent), 7);

      await updateCompanyPricingOverrides(company.id, { bookingCommissionPercent: null });
      p = await getEffectiveCompanyPricing(company.id);
      assert.equal(Number(p.bookingCommissionPercent), 10);
      // The other override is unchanged.
      assert.equal(Number(markupPercentForBookingType(p, BookingType.daily)), 80);
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });

  test("a commission over 100 is rejected", async () => {
    const company = await createCompany();
    try {
      await assert.rejects(() => updateCompanyPricingOverrides(company.id, { bookingCommissionPercent: 150 }));
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });
});

// 2026-07-27 — admin UI request: the per-supplier override table needed
// search + pagination before the company list "gets crazy" as it grows,
// same concern already solved for /api/admin/users.
describe("listCompanyPricingOverrides — search + pagination", () => {
  test("search filters to matching company names only, with an accurate total", async () => {
    const prefix = `PricingSearchXYZ-${Date.now()}`;
    const companies = await Promise.all([
      prisma.company.create({ data: { name: `${prefix} Alpha` } }),
      prisma.company.create({ data: { name: `${prefix} Beta` } }),
      prisma.company.create({ data: { name: `${prefix} Gamma` } }),
    ]);
    try {
      const result = await listCompanyPricingOverrides({ search: prefix });
      assert.equal(result.meta.total, 3);
      assert.equal(result.companies.length, 3);
      assert.ok(result.companies.every((c) => c.companyName.startsWith(prefix)));

      // Case-insensitive, matches the admin/users search convention.
      const lower = await listCompanyPricingOverrides({ search: prefix.toLowerCase() });
      assert.equal(lower.meta.total, 3);
    } finally {
      await prisma.company.deleteMany({ where: { id: { in: companies.map((c) => c.id) } } });
    }
  });

  test("a page past the last result is empty but reports the real total", async () => {
    const prefix = `PricingSearchPage-${Date.now()}`;
    const company = await prisma.company.create({ data: { name: prefix } });
    try {
      const result = await listCompanyPricingOverrides({ search: prefix, page: 2 });
      assert.equal(result.companies.length, 0);
      assert.equal(result.meta.total, 1);
      assert.equal(result.meta.page, 2);
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });
});

describe("getCompanyPricingOverride — single-company lookup for the post-PATCH response", () => {
  test("returns the company's overrides/effective rates independent of the paginated list", async () => {
    const company = await createCompany();
    try {
      await updateCompanyPricingOverrides(company.id, { bookingCommissionPercent: 20 });
      const row = await getCompanyPricingOverride(company.id);
      assert.ok(row);
      assert.equal(row!.companyId, company.id.toString());
      assert.equal(row!.overrides.bookingCommissionPercent, 20);
      assert.equal(row!.effective.bookingCommissionPercent, 20);
      // Untouched field still inherits the platform default.
      assert.equal(row!.overrides.consumablesCommissionPercent, null);
      assert.equal(row!.effective.consumablesCommissionPercent, 7);
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
    }
  });

  test("returns null for a company that doesn't exist", async () => {
    const row = await getCompanyPricingOverride(BigInt(999999999));
    assert.equal(row, null);
  });
});
