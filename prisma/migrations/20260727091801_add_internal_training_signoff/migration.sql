-- CreateEnum
CREATE TYPE "internal_training_event_status" AS ENUM ('draft', 'submitted', 'completed');

-- CreateEnum
CREATE TYPE "internal_training_participant_status" AS ENUM ('pending_evidence', 'awaiting_signoff', 'passed', 'failed');

-- AlterEnum: new activity_action_type values for the internal-training-signoff
-- flow (lib/internal-training-events.ts). Not used by any DML in this file,
-- so no same-transaction "unsafe use of new enum value" issue.
ALTER TYPE "activity_action_type" ADD VALUE 'internal_training_event_created';
ALTER TYPE "activity_action_type" ADD VALUE 'internal_training_evidence_uploaded';
ALTER TYPE "activity_action_type" ADD VALUE 'internal_training_participant_reviewed';

-- AlterEnum: notes WHICH ROLE submitted a certificate request into the
-- existing system-admin approval queue (lib/certificates.ts) — a buyer-org
-- admin, alongside the existing supplier_created.
ALTER TYPE "certificate_source" ADD VALUE 'buyer_org_created';

-- Note: the generated diff also included
-- `ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT ...`, a
-- no-op re-emission of a dbgenerated() default that already matches the DB
-- exactly (confirmed via `psql \d users`) — same unrelated-drift artifact
-- flagged in migration 20260727081239_add_credential_provenance's own notes.
-- Left out of this migration for the same reason: this session's change
-- didn't cause it.

-- CreateTable
CREATE TABLE "internal_training_events" (
    "id" BIGSERIAL NOT NULL,
    "buyer_organization_id" BIGINT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "certificate_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "training_date" DATE NOT NULL,
    "equipment_details" TEXT NOT NULL,
    "trainer_name" TEXT NOT NULL,
    "status" "internal_training_event_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_training_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_training_participants" (
    "id" BIGSERIAL NOT NULL,
    "event_id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "evidence_key" TEXT,
    "uploaded_by_user_id" TEXT,
    "status" "internal_training_participant_status" NOT NULL DEFAULT 'pending_evidence',
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_training_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_training_events_buyer_organization_id_status_idx" ON "internal_training_events"("buyer_organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "internal_training_participants_event_id_user_id_key" ON "internal_training_participants"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "internal_training_events" ADD CONSTRAINT "internal_training_events_buyer_organization_id_fkey" FOREIGN KEY ("buyer_organization_id") REFERENCES "buyer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_training_events" ADD CONSTRAINT "internal_training_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_training_events" ADD CONSTRAINT "internal_training_events_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_training_participants" ADD CONSTRAINT "internal_training_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "internal_training_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_training_participants" ADD CONSTRAINT "internal_training_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_training_participants" ADD CONSTRAINT "internal_training_participants_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
