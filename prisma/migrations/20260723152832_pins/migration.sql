-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "pinned_at" TIMESTAMP(3),
ADD COLUMN     "pinned_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
