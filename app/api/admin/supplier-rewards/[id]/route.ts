import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  parseSupplierRewardCategory,
  parseCategoryFields,
  parseCreditCost,
  parseQuantityAvailable,
  clearedFieldsForCategory,
  serializeSupplierRewardCatalogueItem,
} from "@/lib/supplier-reward-catalogue";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = parseBigIntParam(id);
  if (itemId === null) return notFoundResponse("Reward not found.");

  const existing = await prisma.supplierRewardCatalogueItem.findUnique({ where: { id: itemId } });
  if (!existing) return notFoundResponse("Reward not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ body: ["A request body is required."] }));
  }

  try {
    const record = body as Record<string, unknown>;
    const nextCategory = record.category !== undefined ? parseSupplierRewardCategory(record.category) : existing.category;
    const categoryChanged = nextCategory !== existing.category;

    const name =
      record.name !== undefined
        ? (() => {
            if (typeof record.name !== "string" || record.name.trim().length === 0) {
              throw new ApiValidationError({ name: ["name must be a non-empty string."] });
            }
            return record.name.trim();
          })()
        : undefined;

    const description =
      record.description !== undefined
        ? (() => {
            if (typeof record.description !== "string" || record.description.trim().length === 0) {
              throw new ApiValidationError({ description: ["description must be a non-empty string."] });
            }
            return record.description.trim();
          })()
        : undefined;

    if (record.active !== undefined && typeof record.active !== "boolean") {
      throw new ApiValidationError({ active: ["active must be a boolean."] });
    }

    const categoryFields = parseCategoryFields(nextCategory, record);
    const creditCost = parseCreditCost(record.creditCost);
    const quantityAvailable = parseQuantityAvailable(record.quantityAvailable);

    const item = await prisma.supplierRewardCatalogueItem.update({
      where: { id: itemId },
      data: {
        category: nextCategory,
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(record.active !== undefined && { active: record.active as boolean }),
        ...(creditCost !== undefined && { creditCost }),
        ...(quantityAvailable !== undefined && { quantityAvailable }),
        ...(categoryChanged ? clearedFieldsForCategory(nextCategory) : {}),
        ...categoryFields,
      },
    });

    return NextResponse.json({ reward: serializeSupplierRewardCatalogueItem(item) });
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
  if (itemId === null) return notFoundResponse("Reward not found.");

  const existing = await prisma.supplierRewardCatalogueItem.findUnique({ where: { id: itemId } });
  if (!existing) return notFoundResponse("Reward not found.");

  // Hard delete — SupplierRewardRedemption.supplierRewardCatalogueItemId is
  // onDelete: SetNull (same "snapshot fields survive the item" pattern as
  // RewardCatalogueItem), so no cascade concerns.
  await prisma.supplierRewardCatalogueItem.delete({ where: { id: itemId } });

  return NextResponse.json({ deleted: true });
}
