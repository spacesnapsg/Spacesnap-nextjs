-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_action_type" ADD VALUE 'bulk_order_cancelled';
ALTER TYPE "activity_action_type" ADD VALUE 'bulk_order_cancellation_requested';
ALTER TYPE "activity_action_type" ADD VALUE 'bulk_order_cancellation_approved';
ALTER TYPE "activity_action_type" ADD VALUE 'bulk_order_cancellation_rejected';

-- AlterTable
ALTER TABLE "bulk_order_requests" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancellation_requested_at" TIMESTAMP(3),
ADD COLUMN     "estimated_delivery_date" TIMESTAMP(3);
