-- AlterEnum
ALTER TYPE "activity_action_type" ADD VALUE 'booking_modified';

-- AlterEnum
ALTER TYPE "transaction_type" ADD VALUE 'booking_modification_fee';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "is_modified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_refundable_percent" DECIMAL(5,2),
ADD COLUMN     "original_start_date" DATE;
