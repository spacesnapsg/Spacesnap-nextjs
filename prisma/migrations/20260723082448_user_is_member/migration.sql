-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_member" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
