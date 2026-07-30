-- AlterEnum
ALTER TYPE "company_boost_request_type" ADD VALUE 'product';

-- CreateEnum
CREATE TYPE "boost_product_builtin_effect" AS ENUM ('bump', 'pin', 'none');

-- CreateTable
CREATE TABLE "boost_products" (
    "id" BIGSERIAL NOT NULL,
    "builtin_effect" "boost_product_builtin_effect" NOT NULL DEFAULT 'none',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon_name" TEXT NOT NULL DEFAULT 'star',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "price_credits" INTEGER,
    "pin_7_price_credits" INTEGER,
    "pin_30_price_credits" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boost_products_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "company_boost_requests" ADD COLUMN     "boost_product_id" BIGINT;

-- AddForeignKey
ALTER TABLE "company_boost_requests" ADD CONSTRAINT "company_boost_requests_boost_product_id_fkey" FOREIGN KEY ("boost_product_id") REFERENCES "boost_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedData
INSERT INTO "boost_products" (builtin_effect, name, description, icon_name, sort_order, price_credits, pin_7_price_credits, pin_30_price_credits, created_at, updated_at) VALUES
  ('bump', 'Bumps', 'Move a listing to the front of the marketplace, as if newly posted.', 'zap', 0, 50, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pin',  'Pin',   'Pin a listing to the very top of marketplace results for a set duration.', 'pin', 1, NULL, 200, 600, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
