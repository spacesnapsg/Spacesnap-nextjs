-- CreateEnum
CREATE TYPE "credential_provenance" AS ENUM ('tier1_video_quiz', 'tier2a_operator_signoff', 'tier2a1_internal_company_signoff', 'tier2b_operator_or_sme_signoff');

-- AlterTable: listings — opt-in, defaulted false (see schema.prisma comment)
ALTER TABLE "listings" ADD COLUMN     "accepts_internal_signoff" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: user_certificates — added nullable first so every existing row
-- can be backfilled before the NOT NULL constraint is applied.
ALTER TABLE "user_certificates" ADD COLUMN     "earned_via" "credential_provenance";

-- Backfill: today, every certificate has exactly one earning path
-- (certificates.earning_method), so it's a direct 1:1 mapping onto the new
-- per-credential provenance for every pre-existing user_certificates row.
UPDATE "user_certificates" uc
SET "earned_via" = (
  CASE c."earning_method"
    WHEN 'tier1_video_quiz' THEN 'tier1_video_quiz'
    WHEN 'tier2a_operator_signoff' THEN 'tier2a_operator_signoff'
    WHEN 'tier2b_operator_or_sme_signoff' THEN 'tier2b_operator_or_sme_signoff'
  END
)::"credential_provenance"
FROM "certificates" c
WHERE c."id" = uc."certificate_id";

-- Now that every row is backfilled, enforce NOT NULL going forward.
ALTER TABLE "user_certificates" ALTER COLUMN "earned_via" SET NOT NULL;
