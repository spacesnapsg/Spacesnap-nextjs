-- CreateEnum
CREATE TYPE "reward_catalogue_category" AS ENUM ('discount', 'pitch_ticket', 'consultancy', 'events', 'lucky_draw', 'tier_upgrade', 'consumable');

-- CreateEnum
CREATE TYPE "reward_discount_applies_to" AS ENUM ('booking', 'equipment', 'certification_fee');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "reward_catalogue_items" (
    "id" BIGSERIAL NOT NULL,
    "category" "reward_catalogue_category" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "discount_percent" DECIMAL(5,2),
    "discount_applies_to" "reward_discount_applies_to"[] DEFAULT ARRAY[]::"reward_discount_applies_to"[],
    "partner_name" TEXT,
    "consultancy_subject" TEXT,
    "event_name" TEXT,
    "event_info" TEXT,
    "prize_description" TEXT,
    "prize_quantity" INTEGER,
    "upgrade_duration_months" INTEGER,
    "consumable_name" TEXT,
    "consumable_quantity" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_catalogue_items_pkey" PRIMARY KEY ("id")
);
