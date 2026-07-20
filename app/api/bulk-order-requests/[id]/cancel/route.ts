import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { notFoundResponse, unauthorizedResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBulkOrderRequest,
  cancelBulkOrderByUser,
  BulkOrderNotOwnedError,
  BulkOrderNotCancellableError,
} from "@/lib/bulk-orders";

// PATCH: the requester cancels their own still-pending bulk order directly —
// no supplier review needed, since nothing has been debited and the supplier
// hasn't acted on it yet. Once confirmed, use
// POST /api/bulk-order-requests/[id]/request-cancellation instead.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const bulkOrderRequestId = parseBigIntParam(id);
  if (bulkOrderRequestId === null) return notFoundResponse("Bulk order request not found.");

  try {
    const updated = await cancelBulkOrderByUser(bulkOrderRequestId, session.user.id);
    return NextResponse.json({ bulkOrderRequest: serializeBulkOrderRequest(updated) });
  } catch (error) {
    if (error instanceof BulkOrderNotOwnedError) {
      return notFoundResponse("Bulk order request not found.");
    }
    if (error instanceof BulkOrderNotCancellableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
