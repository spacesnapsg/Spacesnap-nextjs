-- Rename "invoicing" terminology to "payout" — this ledger/cadence tracks
-- what SpaceSnap pays OUT to a supplier, not something the supplier
-- invoices SpaceSnap for. No production data affected (supplier_payables
-- was empty at the time of this migration).

ALTER TYPE "invoicing_cadence" RENAME TO "payout_cadence";

ALTER TABLE "supplier_payables" RENAME COLUMN "invoicing_cadence" TO "payout_cadence";

ALTER TYPE "supplier_payable_status" RENAME VALUE 'invoiced' TO 'scheduled';
