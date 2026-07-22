-- AlterTable
ALTER TABLE "activity_log" ADD COLUMN     "related_training_session_id" BIGINT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_related_training_session_id_fkey" FOREIGN KEY ("related_training_session_id") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
