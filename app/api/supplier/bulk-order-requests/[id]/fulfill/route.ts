import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBulkOrderRequest,
  fulfillBulkOrderWithDebit,
  BulkOrderNotFulfillableError,
} from "@/lib/bulk-orders";
import { InsufficientCreditBalanceError } from "@/lib/credits";

// This is the only bulk-order transition that moves credits — mirrors old
// SupplierBulkOrderController::update's `fulfilled` branch. See
// fulfillBulkOrderWithDebit (lib/bulk-orders.ts) for the balance check +
// debit Transaction.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const bulkOrderRequestId = parseBigIntParam(id);
  if (bulkOrderRequestId === null) return notFoundResponse("Bulk order request not found.");

  const bulkOrderRequest = await prisma.bulkOrderRequest.findUnique({
    where: { id: bulkOrderRequestId },
    include: { listing: true },
  });
  if (!bulkOrderRequest) return notFoundResponse("Bulk order request not found.");
  if (bulkOrderRequest.listing.companyId !== auth.companyId) {
    return forbiddenResponse("You do not have access to this bulk order request.");
  }

  try {
    const updated = await fulfillBulkOrderWithDebit(bulkOrderRequestId);
    return NextResponse.json({ bulkOrderRequest: serializeBulkOrderRequest(updated) });
  } catch (error) {
    if (error instanceof BulkOrderNotFulfillableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof InsufficientCreditBalanceError) {
      return NextResponse.json({ message: "Requester has insufficient credit balance to fulfill this order." }, { status: 422 });
    }
    throw error;
  }
}
