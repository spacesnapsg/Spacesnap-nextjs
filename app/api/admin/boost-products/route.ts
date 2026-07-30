import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBoostProductCreateFields, computeNextSortOrder, serializeBoostProduct } from "@/lib/boost-products";

// Admin CRUD for the "Boost Your Listings" catalogue — see BoostProduct's
// own schema comment. Mirrors app/api/admin/rewards/route.ts's shape.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const items = await prisma.boostProduct.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ boostProducts: items.map(serializeBoostProduct) });
}

export async function POST(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ name: ["name is required."] }));
  }

  try {
    const fields = parseBoostProductCreateFields(body as Record<string, unknown>);
    const sortOrder = await computeNextSortOrder();

    const item = await prisma.boostProduct.create({
      data: { ...fields, builtinEffect: "none", sortOrder },
    });

    return NextResponse.json({ boostProduct: serializeBoostProduct(item) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
