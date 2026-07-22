-- AlterTable
ALTER TABLE "reward_catalogue_items" ADD COLUMN     "credit_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "quantity_available" INTEGER,
ADD COLUMN     "redeemed_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
