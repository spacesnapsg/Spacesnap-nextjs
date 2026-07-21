-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "related_certificate_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_related_certificate_id_type_key" ON "notifications"("user_id", "related_certificate_id", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_certificate_id_fkey" FOREIGN KEY ("related_certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
