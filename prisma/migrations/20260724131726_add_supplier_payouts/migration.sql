-- CreateEnum
CREATE TYPE "supplier_payout_status" AS ENUM ('billed', 'paid');

-- AlterTable
ALTER TABLE "supplier_payables" ADD COLUMN     "payout_id" BIGINT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "supplier_payouts" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" "supplier_payout_status" NOT NULL DEFAULT 'billed',
    "xero_bill_url" TEXT,
    "xero_remittance_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payouts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "supplier_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payouts" ADD CONSTRAINT "supplier_payouts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
