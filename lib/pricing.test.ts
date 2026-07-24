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
