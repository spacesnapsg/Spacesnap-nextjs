-- CreateEnum
CREATE TYPE "training_enrollment_status" AS ENUM ('enrolled', 'awaiting_signoff', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "training_enrollments" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "training_session_id" BIGINT NOT NULL,
    "status" "training_enrollment_status" NOT NULL DEFAULT 'enrolled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_enrollments_user_id_training_session_id_key" ON "training_enrollments"("user_id", "training_session_id");

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_training_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
