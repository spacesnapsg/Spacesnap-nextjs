-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "buyer_organization_id" BIGINT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "buyer_org_promotion_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "buyer_organization_id" BIGINT,
ADD COLUMN     "is_buyer_org_admin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "company_join_requests" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'pending',
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_organizations" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "registration_number" TEXT,
    "finance_contact_email" TEXT,
    "finance_contact_person" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_organization_join_requests" (
    "id" BIGSERIAL NOT NULL,
    "buyer_organization_id" BIGINT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'pending',
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_organization_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_join_requests_company_id_status_idx" ON "company_join_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "buyer_organization_join_requests_buyer_organization_id_stat_idx" ON "buyer_organization_join_requests"("buyer_organization_id", "status");

-- AddForeignKey
ALTER TABLE "company_join_requests" ADD CONSTRAINT "company_join_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_join_requests" ADD CONSTRAINT "company_join_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_join_requests" ADD CONSTRAINT "company_join_requests_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_organization_join_requests" ADD CONSTRAINT "buyer_organization_join_requests_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "buyer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_organization_join_requests" ADD CONSTRAINT "buyer_organization_join_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_organization_join_requests" ADD CONSTRAINT "buyer_organization_join_requests_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "buyer_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "buyer_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mirrors users_company_admin_requires_supplier (migration
-- 20260718192008_users_company_admin_requires_supplier): capabilities are
-- additive, so a buyer-org admin must actually belong to the org they
-- administer. Prisma schema can't express cross-column CHECK constraints
-- natively, same pattern as every other raw-SQL constraint in this project.
ALTER TABLE "users"
  ADD CONSTRAINT "users_buyer_org_admin_requires_org"
  CHECK (NOT "is_buyer_org_admin" OR "buyer_organization_id" IS NOT NULL);
