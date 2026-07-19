-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_action_type" ADD VALUE 'quiz_attempt_submitted';
ALTER TYPE "activity_action_type" ADD VALUE 'credential_issued';

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN     "certificate_id" BIGINT;

-- AlterTable
ALTER TABLE "training_videos" ADD COLUMN     "certificate_id" BIGINT;

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "training_video_id" BIGINT NOT NULL,
    "score" INTEGER NOT NULL,
    "total_questions" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "training_videos" ADD CONSTRAINT "training_videos_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_training_video_id_fkey" FOREIGN KEY ("training_video_id") REFERENCES "training_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
