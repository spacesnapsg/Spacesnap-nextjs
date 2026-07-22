-- Sprint 6.10 fulfillment session (2026-07-22), confirmed with the product
-- owner — see SPRINT_PLAN_NEXTJS_REWRITE.md's "per-category redemption/
-- fulfillment design" section.

-- RewardGrant: optional expiry (only set by grants the rewards catalogue
-- issues going forward, e.g. a redeemed Discount Voucher — 90 days).
ALTER TABLE "reward_grants" ADD COLUMN "expires_at" TIMESTAMP(3);

-- RewardDiscountAppliesTo: drop the unused `certification_fee` value.
-- Postgres has no ALTER TYPE ... DROP VALUE, so the enum is recreated.
-- Confirmed via a direct query before writing this migration that no row
-- currently uses 'certification_fee' (only ever seeded with ['booking']),
-- so this cast is safe.
ALTER TYPE "reward_discount_applies_to" RENAME TO "reward_discount_applies_to_old";
CREATE TYPE "reward_discount_applies_to" AS ENUM ('booking', 'equipment');
ALTER TABLE "reward_catalogue_items"
  ALTER COLUMN "discount_applies_to" DROP DEFAULT,
  ALTER COLUMN "discount_applies_to" TYPE "reward_discount_applies_to"[]
    USING "discount_applies_to"::text[]::"reward_discount_applies_to"[],
  ALTER COLUMN "discount_applies_to" SET DEFAULT ARRAY[]::"reward_discount_applies_to"[];
DROP TYPE "reward_discount_applies_to_old";

-- RewardCatalogueItem: partner_name -> partner_options (a user now picks
-- from a list of partners at redemption time instead of one fixed partner
-- per catalogue item). Existing placeholder values ("TBD") are carried over
-- as a single-element array so nothing is silently dropped.
ALTER TABLE "reward_catalogue_items" ADD COLUMN "partner_options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "reward_catalogue_items"
  SET "partner_options" = ARRAY["partner_name"]
  WHERE "partner_name" IS NOT NULL;
ALTER TABLE "reward_catalogue_items" DROP COLUMN "partner_name";

-- RewardRedemption: fulfillment status + per-category snapshot fields.
CREATE TYPE "reward_redemption_status" AS ENUM ('pending', 'used', 'cancelled');
ALTER TABLE "reward_redemptions" ADD COLUMN "status" "reward_redemption_status" NOT NULL DEFAULT 'used';
ALTER TABLE "reward_redemptions" ADD COLUMN "selected_partner_option" TEXT;
ALTER TABLE "reward_redemptions" ADD COLUMN "expires_at" TIMESTAMP(3);
