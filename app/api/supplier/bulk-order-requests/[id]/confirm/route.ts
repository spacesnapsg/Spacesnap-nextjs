import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, forbiddenResponse, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  serializeBulkOrderRequest,
  confirmBulkOrder,
  parseEstimatedDeliveryDate,
  BulkOrderNotConfirmableError,
} from "@/lib/bulk-orders";
import { InsufficientAvailableCreditError } from "@/lib/credit-holds";

// estimatedDeliveryDate is required in the body (2026-07-20 product owner
// request) — see parseEstimatedDeliveryDate, lib/bulk-orders.ts. `override`
// (optional boolean, credit-hold feature, same date) lets the supplier push
// a confirm through after seeing the insufficient-available-credit warning
// below — omitted/false means "ask first."
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const bulkOrderRequestId = parseBigIntParam(id);
  if (bulkOrderRequestId === null) return notFoundResponse("Bulk order request not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let estimatedDeliveryDate;
  try {
    estimatedDeliveryDate = parseEstimatedDeliveryDate(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const bulkOrderRequest = await prisma.bulkOrderRequest.findUnique({
    where: { id: bulkOrderRequestId },
    include: { listing: true },
  });
  if (!bulkOrderRequest) return notFoundResponse("Bulk order request not found.");
  if (bulkOrderRequest.listing.companyId !== auth.companyId) {
    return forbiddenResponse("You do not have access to this bulk order request.");
  }

  const override = (body as Record<string, unknown>).override === true;

  try {
    const updated = await confirmBulkOrder(bulkOrderRequestId, estimatedDeliveryDate, { override });
    return NextResponse.json({ bulkOrderRequest: serializeBulkOrderRequest(updated) });
  } catch (error) {
    if (error instanceof BulkOrderNotConfirmableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    if (error instanceof InsufficientAvailableCreditError) {
      return NextResponse.json(
        {
          message: error.message,
          requiresOverride: true,
          available: Number(error.available),
          required: Number(error.required),
        },
        { status: 409 }
      );
    }
    throw error;
  }
}
