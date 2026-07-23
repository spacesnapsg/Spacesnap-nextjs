-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_activity_at" TIMESTAMP(3),
ADD COLUMN     "last_edm_seen_at" TIMESTAMP(3),
ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
