-- CreateEnum
CREATE TYPE "supplier_reward_category" AS ENUM ('report', 'ad', 'system');

-- CreateEnum
CREATE TYPE "supplier_report_target_group" AS ENUM ('bookings', 'equipment', 'consumables');

-- CreateEnum
CREATE TYPE "supplier_reward_redemption_status" AS ENUM ('pending', 'used', 'cancelled');

-- AlterEnum
ALTER TYPE "activity_action_type" ADD VALUE 'supplier_reward_redeemed';

-- AlterEnum
ALTER TYPE "company_transaction_type" ADD VALUE 'earned_spend';

-- AlterTable
ALTER TABLE "company_transactions" ADD COLUMN     "supplier_reward_redemption_id" BIGINT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "supplier_reward_catalogue_items" (
    "id" BIGSERIAL NOT NULL,
    "category" "supplier_reward_category" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "credit_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantity_available" INTEGER,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "report_target_groups" "supplier_report_target_group"[] DEFAULT ARRAY[]::"supplier_report_target_group"[],
    "campaign_duration_days" INTEGER,
    "upgrade_duration_months" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_reward_catalogue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_reward_redemptions" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "redeemed_by_user_id" TEXT NOT NULL,
    "supplier_reward_catalogue_item_id" BIGINT,
    "item_name" TEXT NOT NULL,
    "item_category" "supplier_reward_category" NOT NULL,
    "credit_cost" DECIMAL(10,2) NOT NULL,
    "status" "supplier_reward_redemption_status" NOT NULL DEFAULT 'used',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_reward_redemptions_company_id_idx" ON "supplier_reward_redemptions"("company_id");

-- AddForeignKey
ALTER TABLE "company_transactions" ADD CONSTRAINT "company_transactions_supplier_reward_redemption_id_fkey" FOREIGN KEY ("supplier_reward_redemption_id") REFERENCES "supplier_reward_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_reward_redemptions" ADD CONSTRAINT "supplier_reward_redemptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_reward_redemptions" ADD CONSTRAINT "supplier_reward_redemptions_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_reward_redemptions" ADD CONSTRAINT "supplier_reward_redemptions_supplier_reward_catalogue_item_fkey" FOREIGN KEY ("supplier_reward_catalogue_item_id") REFERENCES "supplier_reward_catalogue_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
