import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import {
  parseSupplierRewardCategory,
  parseCategoryFields,
  parseCreditCost,
  parseQuantityAvailable,
  serializeSupplierRewardCatalogueItem,
} from "@/lib/supplier-reward-catalogue";

// Admin CRUD for the SUPPLIER-facing rewards catalogue — the company-scoped
// sibling of /api/admin/rewards (Sprint 6.7/6.9), open-ended (not a fixed
// set), see SupplierRewardCatalogueItem's own schema comment.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const items = await prisma.supplierRewardCatalogueItem.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ rewards: items.map(serializeSupplierRewardCatalogueItem) });
}

export async function POST(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ category: ["category is required."] }));
  }

  try {
    const record = body as Record<string, unknown>;
    const category = parseSupplierRewardCategory(record.category);

    if (typeof record.name !== "string" || record.name.trim().length === 0) {
      throw new ApiValidationError({ name: ["name is required."] });
    }
    if (typeof record.description !== "string" || record.description.trim().length === 0) {
      throw new ApiValidationError({ description: ["description is required."] });
    }

    const categoryFields = parseCategoryFields(category, record);
    const creditCost = parseCreditCost(record.creditCost) ?? new Prisma.Decimal(0);
    const quantityAvailable = parseQuantityAvailable(record.quantityAvailable);

    const item = await prisma.supplierRewardCatalogueItem.create({
      data: {
        category,
        name: record.name.trim(),
        description: record.description.trim(),
        active: typeof record.active === "boolean" ? record.active : true,
        creditCost,
        ...(quantityAvailable !== undefined && { quantityAvailable }),
        ...categoryFields,
      },
    });

    return NextResponse.json({ reward: serializeSupplierRewardCatalogueItem(item) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
