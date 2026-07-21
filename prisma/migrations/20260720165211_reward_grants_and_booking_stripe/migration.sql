-- CreateEnum
CREATE TYPE "reward_grant_type" AS ENUM ('booking_discount_pct', 'free_consumable_unit', 'gig_payout_credit');

-- CreateEnum
CREATE TYPE "reward_grant_status" AS ENUM ('available', 'redeemed', 'expired');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "reward_grant_id" BIGINT;

-- CreateTable
CREATE TABLE "reward_grants" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "reward_grant_type" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "status" "reward_grant_status" NOT NULL DEFAULT 'available',
    "granted_via" TEXT NOT NULL,
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reward_grants_user_id_status_idx" ON "reward_grants"("user_id", "status");

-- AddForeignKey
ALTER TABLE "reward_grants" ADD CONSTRAINT "reward_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reward_grant_id_fkey" FOREIGN KEY ("reward_grant_id") REFERENCES "reward_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
