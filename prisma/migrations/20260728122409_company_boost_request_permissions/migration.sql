-- CreateEnum
CREATE TYPE "company_boost_request_type" AS ENUM ('bump', 'pin');

-- CreateEnum
CREATE TYPE "company_boost_request_status" AS ENUM ('pending', 'fulfilled', 'declined');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'company_boost_request';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company_can_purchase_boosts" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "company_boost_requests" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "type" "company_boost_request_type" NOT NULL,
    "quantity" INTEGER,
    "listing_id" BIGINT,
    "duration_days" INTEGER,
    "status" "company_boost_request_status" NOT NULL DEFAULT 'pending',
    "decline_reason" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_boost_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_boost_requests_company_id_status_idx" ON "company_boost_requests"("company_id", "status");

-- AddForeignKey
ALTER TABLE "company_boost_requests" ADD CONSTRAINT "company_boost_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_boost_requests" ADD CONSTRAINT "company_boost_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_boost_requests" ADD CONSTRAINT "company_boost_requests_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_boost_requests" ADD CONSTRAINT "company_boost_requests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
