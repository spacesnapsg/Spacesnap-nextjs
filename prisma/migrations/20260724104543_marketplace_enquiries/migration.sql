-- CreateEnum
CREATE TYPE "MarketplaceEnquiryType" AS ENUM ('membership', 'consultancy');

-- CreateEnum
CREATE TYPE "MarketplaceEnquiryStatus" AS ENUM ('pending', 'fulfilled');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "marketplace_enquiries" (
    "id" BIGSERIAL NOT NULL,
    "type" "MarketplaceEnquiryType" NOT NULL,
    "details" TEXT NOT NULL,
    "contact_email" TEXT,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "MarketplaceEnquiryStatus" NOT NULL DEFAULT 'pending',
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_enquiries_status_idx" ON "marketplace_enquiries"("status");

-- AddForeignKey
ALTER TABLE "marketplace_enquiries" ADD CONSTRAINT "marketplace_enquiries_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_enquiries" ADD CONSTRAINT "marketplace_enquiries_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
