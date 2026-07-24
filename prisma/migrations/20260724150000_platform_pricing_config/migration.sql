-- Financial audit F2 follow-on: admin-controlled, per-supplier pricing &
-- commission. A platform-default singleton plus nullable per-company overrides.

-- CreateTable: platform-wide defaults (single row, id = 1).
CREATE TABLE "platform_pricing_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "booking_markup_daily_percent" DECIMAL(6,2) NOT NULL DEFAULT 50,
    "booking_markup_weekly_percent" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "booking_markup_monthly_percent" DECIMAL(6,2) NOT NULL DEFAULT 20,
    "booking_commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "consumables_commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_pricing_config_pkey" PRIMARY KEY ("id")
);

-- Seed the single defaults row so the getter always finds it.
INSERT INTO "platform_pricing_config" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);

-- AlterTable: per-company overrides (nullable = inherit the default above).
ALTER TABLE "companies"
    ADD COLUMN "booking_markup_daily_percent" DECIMAL(6,2),
    ADD COLUMN "booking_markup_weekly_percent" DECIMAL(6,2),
    ADD COLUMN "booking_markup_monthly_percent" DECIMAL(6,2),
    ADD COLUMN "booking_commission_percent" DECIMAL(5,2),
    ADD COLUMN "consumables_commission_percent" DECIMAL(5,2);

-- AlterTable: snapshot the supplier's base price on each booking.
ALTER TABLE "bookings" ADD COLUMN "base_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill: before markup existed, sgd_amount WAS the base (no markup was
-- applied), so pre-migration bookings have base == sgd_amount.
UPDATE "bookings" SET "base_amount" = "sgd_amount";
