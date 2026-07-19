-- CreateEnum
CREATE TYPE "signoff_submission_type" AS ENUM ('recording', 'live_demo_request');

-- CreateEnum
CREATE TYPE "signoff_request_status" AS ENUM ('pending', 'live_demo_requested', 'passed', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_action_type" ADD VALUE 'signoff_requested';
ALTER TYPE "activity_action_type" ADD VALUE 'signoff_reviewed';

-- CreateTable
CREATE TABLE "certificate_signoff_requests" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "certificate_id" BIGINT NOT NULL,
    "submission_type" "signoff_submission_type" NOT NULL,
    "recording_key" TEXT,
    "status" "signoff_request_status" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_signoff_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificate_signoff_requests_user_id_certificate_id_key" ON "certificate_signoff_requests"("user_id", "certificate_id");

-- AddForeignKey
ALTER TABLE "certificate_signoff_requests" ADD CONSTRAINT "certificate_signoff_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_signoff_requests" ADD CONSTRAINT "certificate_signoff_requests_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_signoff_requests" ADD CONSTRAINT "certificate_signoff_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
