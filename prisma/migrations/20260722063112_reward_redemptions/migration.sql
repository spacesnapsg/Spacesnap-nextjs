-- AlterEnum
ALTER TYPE "activity_action_type" ADD VALUE 'reward_redeemed';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "reward_redemption_id" BIGINT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "reward_catalogue_item_id" BIGINT,
    "item_name" TEXT NOT NULL,
    "item_category" "reward_catalogue_category" NOT NULL,
    "credit_cost" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_idx" ON "reward_redemptions"("user_id");

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_catalogue_item_id_fkey" FOREIGN KEY ("reward_catalogue_item_id") REFERENCES "reward_catalogue_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reward_redemption_id_fkey" FOREIGN KEY ("reward_redemption_id") REFERENCES "reward_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
