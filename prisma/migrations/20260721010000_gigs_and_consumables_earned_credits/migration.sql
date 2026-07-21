-- CreateEnum
CREATE TYPE "gig_task_status" AS ENUM ('open', 'assigned', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "gig_payout_choice" AS ENUM ('earned_credit', 'sgd');

-- AlterEnum
ALTER TYPE "transaction_type" ADD VALUE 'gig_payout_sgd';

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "earned_credits_applied" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "gig_tasks" (
    "id" BIGSERIAL NOT NULL,
    "poster_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purchased_spend" DECIMAL(10,2) NOT NULL,
    "status" "gig_task_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gig_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gig_assignments" (
    "id" BIGSERIAL NOT NULL,
    "gig_task_id" BIGINT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "payout_choice" "gig_payout_choice" NOT NULL,
    "payout_amount" DECIMAL(10,2) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gig_assignments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "gig_tasks" ADD CONSTRAINT "gig_tasks_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gig_assignments" ADD CONSTRAINT "gig_assignments_gig_task_id_fkey" FOREIGN KEY ("gig_task_id") REFERENCES "gig_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gig_assignments" ADD CONSTRAINT "gig_assignments_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
