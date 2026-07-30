import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { serializeBoostProduct } from "@/lib/boost-products";

// Any supplier team member can view the catalogue (purchase permission is
// checked separately — requireCompanyBoostPurchasePermission on the actual
// purchase routes). Only active rows: however many exist is however many
// cards ListingBoostCatalogueCard renders.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const items = await prisma.boostProduct.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ boostProducts: items.map(serializeBoostProduct) });
}
