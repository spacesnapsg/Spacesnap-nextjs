-- AlterTable
-- Company.supplierTier is removed — supplier payment tier is now live-computed
-- from rating + rolling-window spend (lib/supplier-tiers.ts, Sprint 6.10),
-- never stored denormalized. The manual admin-set route
-- (PATCH /api/admin/companies/[id]/supplier-tier) is removed in the same
-- session so there's no manual override fighting the automatic calculation.
ALTER TABLE "companies" DROP COLUMN "supplier_tier";

-- DropEnum
DROP TYPE "supplier_tier";
