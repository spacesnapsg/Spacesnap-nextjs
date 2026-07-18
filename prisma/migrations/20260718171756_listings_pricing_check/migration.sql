-- Enforce the pricing shape documented in CODEBASEAPI_SUMMARY.md §4:
-- space/equipment listings must have day/week/month prices set and
-- per_unit/stock/pack_size all null; consumables must have per_unit/stock/
-- pack_size set and day/week/month all null. Never both, never neither.
ALTER TABLE "listings"
  ADD CONSTRAINT "listings_pricing_matches_type"
  CHECK (
    (
      "type" IN ('space', 'equipment')
      AND "price_day" IS NOT NULL
      AND "price_week" IS NOT NULL
      AND "price_month" IS NOT NULL
      AND "price_per_unit" IS NULL
      AND "stock_quantity" IS NULL
      AND "pack_size" IS NULL
    )
    OR
    (
      "type" = 'consumables'
      AND "price_day" IS NULL
      AND "price_week" IS NULL
      AND "price_month" IS NULL
      AND "price_per_unit" IS NOT NULL
      AND "stock_quantity" IS NOT NULL
      AND "pack_size" IS NOT NULL
    )
  );
