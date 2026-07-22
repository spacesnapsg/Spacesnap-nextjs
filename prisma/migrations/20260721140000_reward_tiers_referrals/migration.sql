-- Sprint 6.5 — User Reward Tier system + referral mechanic.
-- See lib/reward-tiers.ts and the schema.prisma comments on Booking/User/
-- ReferralSpendBonus for the full design.

-- AlterEnum
-- Adds two new ActivityActionType values. Each in its own statement (a
-- single ALTER TYPE ... ADD VALUE per statement) — Postgres cannot use a
-- newly-added enum value in the same transaction it was added in, but we
-- don't reference either value elsewhere in this migration, so this is safe
-- to run as-is.
ALTER TYPE "activity_action_type" ADD VALUE 'reward_tier_rebate_earned';
ALTER TYPE "activity_action_type" ADD VALUE 'referral_bonus_earned';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "reward_tier_rebate_percent" DECIMAL(5,2) NOT NULL DEFAULT 1;

-- AlterTable
-- referral_code is added nullable first, backfilled per existing row, then
-- constrained NOT NULL — Prisma can't express "add a NOT NULL UNIQUE column
-- with a generated-per-row value to an already-populated table" natively,
-- same raw-SQL precedent as prisma/migrations/20260718171756_listings_pricing_check.
ALTER TABLE "users" ADD COLUMN     "referral_code" TEXT,
ADD COLUMN     "referral_converted_at" TIMESTAMP(3),
ADD COLUMN     "referred_by_user_id" TEXT;

UPDATE "users" SET "referral_code" = substr(md5(random()::text || id), 1, 8) WHERE "referral_code" IS NULL;

ALTER TABLE "users" ALTER COLUMN "referral_code" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "referral_spend_bonuses" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 200,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_spend_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_fkey" FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_spend_bonuses" ADD CONSTRAINT "referral_spend_bonuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
