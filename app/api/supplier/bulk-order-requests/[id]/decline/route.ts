import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { serializeBulkOrderRequest, declineBulkOrder, BulkOrderNotDeclinableError } from "@/lib/bulk-orders";

// No refund logic needed here (unlike booking decline) — credits are only
// ever debited at fulfillment, never at request creation. See lib/bulk-orders.ts.
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
    const updated = await declineBulkOrder(bulkOrderRequestId);
    return NextResponse.json({ bulkOrderRequest: serializeBulkOrderRequest(updated) });
  } catch (error) {
    if (error instanceof BulkOrderNotDeclinableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
