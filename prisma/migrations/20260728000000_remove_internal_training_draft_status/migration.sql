-- AlterEnum: remove the unused `draft` value from
-- internal_training_event_status (branch feat/enum-hygiene). Confirmed
-- dead: the UI session that built event creation
-- (feat/internal-training-ui) never wrote it explicitly, so every created
-- event silently sat at the implicit `draft` default forever with nothing
-- reading or transitioning it. Postgres has no ALTER TYPE ... DROP VALUE,
-- so the enum type is recreated (new type -> swap column -> drop old type
-- -> rename new type into place), same pattern Prisma's own `migrate diff`
-- proposes for this change. The UPDATE below is a defensive no-op against
-- this migration's actual target (0 rows at the time this was written) —
-- kept so this migration stays correct if it's ever replayed against a
-- database state that does have `draft` rows, since the later USING cast
-- would otherwise fail on any row still literally 'draft'.
BEGIN;

ALTER TABLE "internal_training_events" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "internal_training_events" SET "status" = 'submitted' WHERE "status" = 'draft';

CREATE TYPE "internal_training_event_status_new" AS ENUM ('submitted', 'completed');

ALTER TABLE "internal_training_events"
  ALTER COLUMN "status" TYPE "internal_training_event_status_new"
  USING ("status"::text::"internal_training_event_status_new");

DROP TYPE "internal_training_event_status";

ALTER TYPE "internal_training_event_status_new" RENAME TO "internal_training_event_status";

ALTER TABLE "internal_training_events" ALTER COLUMN "status" SET DEFAULT 'submitted';

COMMIT;
