-- CreateEnum
CREATE TYPE "booking_cancelled_by" AS ENUM ('user', 'supplier');

-- CreateEnum
CREATE TYPE "booking_credit_status" AS ENUM ('available', 'applied', 'expired');

-- CreateEnum
CREATE TYPE "supplier_payable_status" AS ENUM ('pending', 'invoiced', 'paid');

-- CreateEnum
CREATE TYPE "invoicing_cadence" AS ENUM ('monthly', 'biweekly', 'weekly');

-- CreateEnum
CREATE TYPE "supplier_tier" AS ENUM ('free', 'preferred', 'top');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by" "booking_cancelled_by",
ADD COLUMN     "supplier_penalty_percent" DECIMAL(5,2),
ADD COLUMN     "user_refund_percent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "supplier_tier" "supplier_tier" NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "booking_credits" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_booking_id" BIGINT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "booking_credit_status" NOT NULL DEFAULT 'available',
    "applied_to_booking_id" BIGINT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payables" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "booking_id" BIGINT NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "penalty_deduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "status" "supplier_payable_status" NOT NULL DEFAULT 'pending',
    "invoicing_cadence" "invoicing_cadence" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payables_booking_id_key" ON "supplier_payables"("booking_id");

-- AddForeignKey
ALTER TABLE "booking_credits" ADD CONSTRAINT "booking_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_credits" ADD CONSTRAINT "booking_credits_source_booking_id_fkey" FOREIGN KEY ("source_booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_credits" ADD CONSTRAINT "booking_credits_applied_to_booking_id_fkey" FOREIGN KEY ("applied_to_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
