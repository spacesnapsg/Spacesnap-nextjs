-- CreateEnum
CREATE TYPE "activity_action_type" AS ENUM ('booking_created', 'booking_confirmed', 'booking_declined', 'bulk_order_created', 'wallet_topup', 'check_in', 'check_out');

-- CreateTable
CREATE TABLE "activity_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" "activity_action_type" NOT NULL,
    "description" TEXT NOT NULL,
    "related_listing_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_related_listing_id_fkey" FOREIGN KEY ("related_listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
