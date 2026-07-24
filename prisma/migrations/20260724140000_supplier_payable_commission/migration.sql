-- AlterTable
ALTER TABLE "supplier_payables" ADD COLUMN     "commission_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill existing rows (financial audit F2). Only completed-booking payables
-- (gross_amount > 0) ever carried a commission; for those, commission is
-- exactly the difference the row was originally derived from:
--   gross_amount = booking.sgd_amount - commission  =>  commission = sgd_amount - gross_amount
-- Supplier-decline rows (gross_amount 0, penalty_deduction > 0) and user-cancel
-- zero-rows keep the DEFAULT 0 — no commission was earned on a refunded booking.
UPDATE "supplier_payables" sp
SET "commission_amount" = b."sgd_amount" - sp."gross_amount"
FROM "bookings" b
WHERE sp."booking_id" = b."id"
  AND sp."gross_amount" > 0;
