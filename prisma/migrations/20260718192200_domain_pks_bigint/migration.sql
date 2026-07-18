-- Widen all domain-table primary keys (and their FK references) from
-- Int/SERIAL to BigInt/BIGSERIAL, matching the old Laravel schema's
-- BIGSERIAL `id` columns (see CODEBASEAPI_SUMMARY.md §4). `users` is
-- intentionally excluded — it stays `String @id @default(cuid())` for the
-- NextAuth adapter, a deliberate prior decision.
--
-- Hand-written: `prisma migrate diff` renders this as
-- `ALTER COLUMN "id" SET DATA TYPE BIGSERIAL`, but BIGSERIAL is a
-- CREATE-TABLE-only pseudo-type, not valid in ALTER COLUMN ... SET DATA TYPE.
-- The existing `nextval('..._id_seq')` defaults are left untouched — Postgres
-- sequences are always int8 internally regardless of the owning column's
-- declared type, so no sequence changes are needed, only the column type.
-- int4 -> int8 is a supported implicit-cast widening conversion, so no
-- USING clause is required either.

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_created_by_company_id_fkey";

-- DropForeignKey
ALTER TABLE "listing_required_certificates" DROP CONSTRAINT "listing_required_certificates_certificate_id_fkey";

-- DropForeignKey
ALTER TABLE "listing_required_certificates" DROP CONSTRAINT "listing_required_certificates_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "listings" DROP CONSTRAINT "listings_company_id_fkey";

-- DropForeignKey
ALTER TABLE "quiz_answers" DROP CONSTRAINT "quiz_answers_quiz_question_id_fkey";

-- DropForeignKey
ALTER TABLE "quiz_questions" DROP CONSTRAINT "quiz_questions_training_video_id_fkey";

-- DropForeignKey
ALTER TABLE "training_sessions" DROP CONSTRAINT "training_sessions_company_id_fkey";

-- DropForeignKey
ALTER TABLE "training_videos" DROP CONSTRAINT "training_videos_company_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "user_certificates" DROP CONSTRAINT "user_certificates_certificate_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_company_id_fkey";

-- DropForeignKey
ALTER TABLE "video_completions" DROP CONSTRAINT "video_completions_training_video_id_fkey";

-- AlterTable
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "listing_id" TYPE BIGINT,
ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "created_by_company_id" TYPE BIGINT,
ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "companies" DROP CONSTRAINT "companies_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "listing_required_certificates" DROP CONSTRAINT "listing_required_certificates_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "listing_id" TYPE BIGINT,
ALTER COLUMN "certificate_id" TYPE BIGINT,
ADD CONSTRAINT "listing_required_certificates_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "listings" DROP CONSTRAINT "listings_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "company_id" TYPE BIGINT,
ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "quiz_answers" DROP CONSTRAINT "quiz_answers_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "quiz_question_id" TYPE BIGINT,
ADD CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "quiz_questions" DROP CONSTRAINT "quiz_questions_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "training_video_id" TYPE BIGINT,
ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "training_sessions" DROP CONSTRAINT "training_sessions_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "company_id" TYPE BIGINT,
ADD CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "training_videos" DROP CONSTRAINT "training_videos_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "company_id" TYPE BIGINT,
ADD CONSTRAINT "training_videos_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "booking_id" TYPE BIGINT,
ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_certificates" DROP CONSTRAINT "user_certificates_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "certificate_id" TYPE BIGINT,
ADD CONSTRAINT "user_certificates_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "company_id" TYPE BIGINT;

-- AlterTable
ALTER TABLE "video_completions" DROP CONSTRAINT "video_completions_pkey",
ALTER COLUMN "id" TYPE BIGINT,
ALTER COLUMN "training_video_id" TYPE BIGINT,
ADD CONSTRAINT "video_completions_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_created_by_company_id_fkey" FOREIGN KEY ("created_by_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_required_certificates" ADD CONSTRAINT "listing_required_certificates_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_required_certificates" ADD CONSTRAINT "listing_required_certificates_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_certificates" ADD CONSTRAINT "user_certificates_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_videos" ADD CONSTRAINT "training_videos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_completions" ADD CONSTRAINT "video_completions_training_video_id_fkey" FOREIGN KEY ("training_video_id") REFERENCES "training_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_training_video_id_fkey" FOREIGN KEY ("training_video_id") REFERENCES "training_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
