-- AlterEnum
ALTER TYPE "activity_action_type" ADD VALUE 'booking_cancelled';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "platform_commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 10;
