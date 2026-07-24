-- Financial audit F2 Part C: generalize supplier_payables beyond bookings so a
-- consumable sale (Buy Now purchase or fulfilled bulk order) earns a
-- 7%-commission payout row, batched/reconciled through the same SupplierPayout
-- flow.

-- booking_id is no longer the only source — make it nullable (its @unique
-- index stays; Postgres allows many NULLs in a unique index).
ALTER TABLE "supplier_payables" ALTER COLUMN "booking_id" DROP NOT NULL;

-- The two new consumable sources.
ALTER TABLE "supplier_payables"
    ADD COLUMN "purchase_id" BIGINT,
    ADD COLUMN "bulk_order_request_id" BIGINT;

CREATE UNIQUE INDEX "supplier_payables_purchase_id_key" ON "supplier_payables"("purchase_id");
CREATE UNIQUE INDEX "supplier_payables_bulk_order_request_id_key" ON "supplier_payables"("bulk_order_request_id");

ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_purchase_id_fkey"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_bulk_order_request_id_fkey"
    FOREIGN KEY ("bulk_order_request_id") REFERENCES "bulk_order_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one source per row (Prisma can't express a cross-column CHECK).
-- Existing rows are all booking-only, so they satisfy this.
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_exactly_one_source" CHECK (
    (("booking_id" IS NOT NULL)::int + ("purchase_id" IS NOT NULL)::int + ("bulk_order_request_id" IS NOT NULL)::int) = 1
);
