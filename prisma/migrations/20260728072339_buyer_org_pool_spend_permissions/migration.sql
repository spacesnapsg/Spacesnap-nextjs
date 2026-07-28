-- CreateEnum
CREATE TYPE "buyer_org_spend_request_type" AS ENUM ('booking', 'consumable_purchase');

-- CreateEnum
CREATE TYPE "buyer_org_spend_request_status" AS ENUM ('pending', 'fulfilled', 'declined');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'buyer_org_spend_request';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "buyer_org_can_book" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "buyer_org_can_purchase" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "buyer_org_spend_requests" (
    "id" BIGSERIAL NOT NULL,
    "buyer_organization_id" BIGINT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "type" "buyer_org_spend_request_type" NOT NULL,
    "listing_id" BIGINT NOT NULL,
    "booking_type" "booking_type",
    "start_date" DATE,
    "end_date" DATE,
    "quantity" INTEGER,
    "status" "buyer_org_spend_request_status" NOT NULL DEFAULT 'pending',
    "decline_reason" TEXT,
    "resulting_booking_id" BIGINT,
    "resulting_purchase_id" BIGINT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_org_spend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buyer_org_spend_requests_resulting_booking_id_key" ON "buyer_org_spend_requests"("resulting_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_org_spend_requests_resulting_purchase_id_key" ON "buyer_org_spend_requests"("resulting_purchase_id");

-- CreateIndex
CREATE INDEX "buyer_org_spend_requests_buyer_organization_id_status_idx" ON "buyer_org_spend_requests"("buyer_organization_id", "status");

-- AddForeignKey
ALTER TABLE "buyer_org_spend_requests" ADD CONSTRAINT "buyer_org_spend_requests_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "buyer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_org_spend_requests" ADD CONSTRAINT "buyer_org_spend_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_org_spend_requests" ADD CONSTRAINT "buyer_org_spend_requests_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_org_spend_requests" ADD CONSTRAINT "buyer_org_spend_requests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_org_spend_requests" ADD CONSTRAINT "buyer_org_spend_requests_resulting_booking_id_fkey" FOREIGN KEY ("resulting_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_org_spend_requests" ADD CONSTRAINT "buyer_org_spend_requests_resulting_purchase_id_fkey" FOREIGN KEY ("resulting_purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
