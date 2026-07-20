import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, notFoundResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBulkOrderRequest,
  requestBulkOrderCancellation,
  parseCancellationRequestFields,
  BulkOrderNotOwnedError,
  BulkOrderCancellationNotRequestableError,
} from "@/lib/bulk-orders";

// POST: the requester asks to cancel an already-confirmed bulk order, with a
// reason — the supplier has to approve or reject it (see
// PATCH /api/supplier/bulk-order-requests/[id]/approve-cancellation and
// .../reject-cancellation). New feature, 2026-07-20 product owner request.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const bulkOrderRequestId = parseBigIntParam(id);
  if (bulkOrderRequestId === null) return notFoundResponse("Bulk order request not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseCancellationRequestFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    const updated = await requestBulkOrderCancellation(bulkOrderRequestId, session.user.id, fields.reason);
    return NextResponse.json({ bulkOrderRequest: serializeBulkOrderRequest(updated) });
  } catch (error) {
    if (error instanceof BulkOrderNotOwnedError) {
      return notFoundResponse("Bulk order request not found.");
    }
    if (error instanceof BulkOrderCancellationNotRequestableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
