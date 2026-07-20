-- CreateEnum
CREATE TYPE "credit_hold_status" AS ENUM ('active', 'released');

-- AlterEnum
ALTER TYPE "activity_action_type" ADD VALUE 'bulk_order_confirmed_despite_insufficient_credit';

-- CreateTable
CREATE TABLE "credit_holds" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "bulk_order_request_id" BIGINT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "credit_hold_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "credit_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_holds_bulk_order_request_id_key" ON "credit_holds"("bulk_order_request_id");

-- CreateIndex
CREATE INDEX "credit_holds_user_id_status_idx" ON "credit_holds"("user_id", "status");

-- AddForeignKey
ALTER TABLE "credit_holds" ADD CONSTRAINT "credit_holds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_holds" ADD CONSTRAINT "credit_holds_bulk_order_request_id_fkey" FOREIGN KEY ("bulk_order_request_id") REFERENCES "bulk_order_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
