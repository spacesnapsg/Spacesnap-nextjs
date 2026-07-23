-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "admin_edm_campaigns" (
    "id" BIGSERIAL NOT NULL,
    "image_key" TEXT NOT NULL,
    "caption" TEXT,
    "target_members" BOOLEAN NOT NULL DEFAULT true,
    "target_suppliers" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_edm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_edm_campaigns" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "image_key" TEXT NOT NULL,
    "caption" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_edm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_edm_campaigns_company_id_key" ON "supplier_edm_campaigns"("company_id");

-- AddForeignKey
ALTER TABLE "admin_edm_campaigns" ADD CONSTRAINT "admin_edm_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_edm_campaigns" ADD CONSTRAINT "supplier_edm_campaigns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_edm_campaigns" ADD CONSTRAINT "supplier_edm_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
