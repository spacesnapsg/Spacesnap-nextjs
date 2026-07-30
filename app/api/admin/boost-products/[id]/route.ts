import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { parseBoostProductUpdateFields, assertDeletable, serializeBoostProduct, BuiltinBoostProductNotDeletableError } from "@/lib/boost-products";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = parseBigIntParam(id);
  if (itemId === null) return notFoundResponse("Boost product not found.");

  const existing = await prisma.boostProduct.findUnique({ where: { id: itemId } });
  if (!existing) return notFoundResponse("Boost product not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ body: ["A request body is required."] }));
  }

  try {
    const fields = parseBoostProductUpdateFields(existing.builtinEffect, body as Record<string, unknown>);

    const item = await prisma.boostProduct.update({
      where: { id: itemId },
      data: fields,
    });

    return NextResponse.json({ boostProduct: serializeBoostProduct(item) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = parseBigIntParam(id);
  if (itemId === null) return notFoundResponse("Boost product not found.");

  const existing = await prisma.boostProduct.findUnique({ where: { id: itemId } });
  if (!existing) return notFoundResponse("Boost product not found.");

  try {
    assertDeletable(existing);
  } catch (error) {
    if (error instanceof BuiltinBoostProductNotDeletableError) {
      return validationErrorResponse(new ApiValidationError({ builtinEffect: [error.message] }));
    }
    throw error;
  }

  // Hard delete — historical CompanyBoostRequest rows keep their own
  // snapshot-friendly serialization (boostProductName falls back once
  // boostProductId goes null via onDelete: SetNull), so nothing else
  // references this row in a way that needs cascading cleanup.
  await prisma.boostProduct.delete({ where: { id: itemId } });

  return NextResponse.json({ deleted: true });
}
