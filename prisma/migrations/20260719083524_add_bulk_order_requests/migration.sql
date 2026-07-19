-- CreateEnum
CREATE TYPE "bulk_order_status" AS ENUM ('pending', 'confirmed', 'fulfilled', 'cancelled');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "bulk_order_request_id" BIGINT;

-- CreateTable
CREATE TABLE "bulk_order_requests" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "listing_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "credits" DECIMAL(10,2) NOT NULL,
    "status" "bulk_order_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_order_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bulk_order_requests" ADD CONSTRAINT "bulk_order_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_order_requests" ADD CONSTRAINT "bulk_order_requests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bulk_order_request_id_fkey" FOREIGN KEY ("bulk_order_request_id") REFERENCES "bulk_order_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
