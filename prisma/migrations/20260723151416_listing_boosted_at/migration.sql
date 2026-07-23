-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "boosted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing rows should keep their relative marketplace order
-- (previously id asc) rather than all collapsing to this migration's
-- run-time, which the plain ADD COLUMN default above would otherwise do.
UPDATE "listings" SET "boosted_at" = "created_at";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
