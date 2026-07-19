-- CreateEnum
CREATE TYPE "certificate_earning_method" AS ENUM ('tier1_video_quiz', 'tier2a_operator_signoff', 'tier2b_operator_or_sme_signoff');

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "earning_method" "certificate_earning_method" NOT NULL DEFAULT 'tier1_video_quiz';
