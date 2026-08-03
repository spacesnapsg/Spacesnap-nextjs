-- AlterTable
ALTER TABLE "buyer_organization_join_requests" ADD COLUMN     "decline_reason" TEXT;

-- AlterTable
ALTER TABLE "company_join_requests" ADD COLUMN     "decline_reason" TEXT;
