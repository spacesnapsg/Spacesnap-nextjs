-- Purchased/earned balance split (MAS Payment Services Act exposure fix).
-- See the dated comments on TransactionType and Booking in schema.prisma for
-- the full reasoning. Written by hand (not `prisma migrate dev`'s auto-diff)
-- because the diff engine sees `credits` -> `sgdAmount` as a drop+add and
-- would destroy the 5 existing booking rows' data; this uses RENAME COLUMN
-- instead to preserve it.

-- 1. Extend TransactionType additively. Each ADD VALUE is its own statement
--    (required by Postgres) and none of these new values are referenced
--    anywhere else in this same migration, so this is safe inside a single
--    transaction on Postgres 12+.
ALTER TYPE "transaction_type" ADD VALUE 'purchased_topup';
ALTER TYPE "transaction_type" ADD VALUE 'purchased_spend';
ALTER TYPE "transaction_type" ADD VALUE 'earned_grant';
ALTER TYPE "transaction_type" ADD VALUE 'earned_spend';
ALTER TYPE "transaction_type" ADD VALUE 'booking_payment';

-- 2. Repurpose bookings.credits -> bookings.sgd_amount (rename preserves the
--    5 existing rows' data; a booking is no longer paid by wallet deduction,
--    this is now the authoritative real-time SGD/Stripe charge amount).
ALTER TABLE "bookings" RENAME COLUMN "credits" TO "sgd_amount";

-- 3. New discount-tracking column: the optional earnedBalance discount
--    applied to a booking. Defaulted to 0 so the 5 existing rows (all
--    predating the split, none had a discount applied) backfill correctly.
ALTER TABLE "bookings" ADD COLUMN "earned_credits_applied" DECIMAL(10,2) NOT NULL DEFAULT 0;
