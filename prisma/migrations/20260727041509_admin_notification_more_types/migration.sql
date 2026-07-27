-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "admin_notification_type" ADD VALUE 'new_listing';
ALTER TYPE "admin_notification_type" ADD VALUE 'new_purchase';
ALTER TYPE "admin_notification_type" ADD VALUE 'wallet_topup';
ALTER TYPE "admin_notification_type" ADD VALUE 'refund';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);
