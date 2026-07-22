-- Sprint 6.10 fulfillment session (2026-07-22), confirmed with the product
-- owner: a real per-company credit ledger (purchased/earned split, mirroring
-- the per-user Transaction ledger's shape but never merged into it), no
-- spend flow yet.

CREATE TYPE "company_transaction_type" AS ENUM ('purchased_topup', 'earned_rebate');

CREATE TABLE "company_transactions" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "user_id" TEXT,
    "booking_id" BIGINT,
    "type" "company_transaction_type" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_transactions_company_id_idx" ON "company_transactions"("company_id");

ALTER TABLE "company_transactions" ADD CONSTRAINT "company_transactions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_transactions" ADD CONSTRAINT "company_transactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_transactions" ADD CONSTRAINT "company_transactions_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
