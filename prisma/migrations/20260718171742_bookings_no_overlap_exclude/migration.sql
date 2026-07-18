-- Prevent overlapping bookings for the same listing.
-- Mirrors the old Laravel schema's `bookings_no_overlap` constraint (see
-- CODEBASEAPI_SUMMARY.md §4/§5): any status other than `cancelled` still
-- holds the slot (pending/confirmed/active/completed all block), only a
-- cancelled booking frees up the range for reuse.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "listing_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  )
  WHERE (status <> 'cancelled');
