-- Per-supplier earnings attribution (company-admin "by individual supplier"
-- toggle). No backfill: there's no way to infer who "owned" a pre-existing
-- listing, so every existing row gets NULL ("Unassigned") — same idiom as
-- company_boost_requests.boost_product_id (20260729090000_boost_products).
-- New listings set owner_id at create time in the app layer.

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
