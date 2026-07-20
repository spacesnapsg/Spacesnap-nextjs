import { NextRequest, NextResponse } from "next/server";
import { BulkOrderStatus } from "@/app/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  bulkOrderRequestWithRelationsArgs,
  createBulkOrder,
  parseBulkOrderCreateFields,
  serializeBulkOrderRequest,
} from "@/lib/bulk-orders";

const BULK_ORDER_STATUSES = new Set<string>(Object.values(BulkOrderStatus));

// GET: the caller's own bulk order requests (not company-scoped like
// /api/supplier/bulk-order-requests) — needed for the user-side "my orders"
// list, same shape as GET /api/bookings.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const status = new URL(request.url).searchParams.get("status");
  if (status && !BULK_ORDER_STATUSES.has(status)) {
    return NextResponse.json(
      { message: "status must be one of pending, confirmed, fulfilled, cancelled." },
      { status: 422 }
    );
  }

  const bulkOrderRequests = await prisma.bulkOrderRequest.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as BulkOrderStatus } : {}),
    },
    ...bulkOrderRequestWithRelationsArgs,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bulkOrderRequests: bulkOrderRequests.map(serializeBulkOrderRequest) });
}

// POST: create a bulk order request. Mirrors old BulkOrderRequestController::store's
// shape (consumables-only, quantity min:1) exactly, including that no balance
// check or debit happens here — credits are only checked/debited when the
// supplier fulfills the request (see fulfillBulkOrderWithDebit,
// lib/bulk-orders.ts, and PATCH /api/supplier/bulk-order-requests/[id]/fulfill).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseBulkOrderCreateFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const listing = await prisma.listing.findUnique({ where: { id: fields.listingId } });
  if (!listing) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["listingId does not exist."] }));
  }

  if (listing.type !== "consumables") {
    return validationErrorResponse(
      new ApiValidationError({
        listingId: ["Bulk order requests are only available for consumable listings."],
      })
    );
  }

  if (listing.pricePerUnit === null) {
    return validationErrorResponse(new ApiValidationError({ listingId: ["This listing has no per-unit price set."] }));
  }

  const cost = listing.pricePerUnit.mul(fields.quantity);

  const bulkOrderRequest = await createBulkOrder({
    userId: session.user.id,
    listingId: fields.listingId,
    quantity: fields.quantity,
    cost,
  });

  return NextResponse.json({ bulkOrderRequest: serializeBulkOrderRequest(bulkOrderRequest) }, { status: 201 });
}
