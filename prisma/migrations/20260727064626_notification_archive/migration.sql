-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_archived_created_at_idx" ON "notifications"("user_id", "is_archived", "created_at");
