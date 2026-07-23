-- CreateEnum
CREATE TYPE "banner_portal" AS ENUM ('member', 'supplier');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateTable
CREATE TABLE "banners" (
    "id" BIGSERIAL NOT NULL,
    "portal" "banner_portal" NOT NULL,
    "image_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banners_portal_key" ON "banners"("portal");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
