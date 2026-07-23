-- AlterEnum
ALTER TYPE "company_transaction_type" ADD VALUE 'purchased_spend';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "bumps_available" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
