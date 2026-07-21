-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('cert_earned', 'cert_expiry', 'booking_confirmed', 'credit_topup', 'booking_credit_pending');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_action_type" ADD VALUE 'booking_declined_pending_resolution';
ALTER TYPE "activity_action_type" ADD VALUE 'booking_credit_granted';
ALTER TYPE "activity_action_type" ADD VALUE 'booking_credit_redeemed';
ALTER TYPE "activity_action_type" ADD VALUE 'booking_credit_refunded';

-- AlterEnum
ALTER TYPE "booking_credit_status" ADD VALUE 'refunded';

-- AlterEnum
ALTER TYPE "booking_status" ADD VALUE 'declined_pending_resolution';

-- AlterTable
ALTER TABLE "booking_credits" ADD COLUMN     "refund_obligated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "booking_credit_id" BIGINT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "type" "notification_type",
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "related_booking_id" BIGINT,
    "related_listing_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_credit_id_fkey" FOREIGN KEY ("booking_credit_id") REFERENCES "booking_credits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_booking_id_fkey" FOREIGN KEY ("related_booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_listing_id_fkey" FOREIGN KEY ("related_listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
