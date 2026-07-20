import { NextRequest, NextResponse } from "next/server";
import { BulkOrderStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { serializeBulkOrderRequest, bulkOrderRequestWithRelationsArgs } from "@/lib/bulk-orders";

const BULK_ORDER_STATUSES = new Set<string>(Object.values(BulkOrderStatus));

// Mirrors old SupplierBulkOrderController::index — company-scoped (via the
// listing's companyId), optional status filter.
export async function GET(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !BULK_ORDER_STATUSES.has(status)) {
    return NextResponse.json(
      { message: "status must be one of pending, confirmed, fulfilled, cancelled." },
      { status: 422 }
    );
  }

  const bulkOrderRequests = await prisma.bulkOrderRequest.findMany({
    where: {
      listing: { companyId: auth.companyId },
      ...(status ? { status: status as BulkOrderStatus } : {}),
    },
    ...bulkOrderRequestWithRelationsArgs,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bulkOrderRequests: bulkOrderRequests.map(serializeBulkOrderRequest) });
}
