import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { serializeSupplierRewardCatalogueItem } from "@/lib/supplier-reward-catalogue";

// Any company member — the active supplier rewards catalogue, consumed by
// SupplierRewardsCatalogueModal (previously its hardcoded PLACEHOLDER_REWARDS
// array). Inactive items are never returned here.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const items = await prisma.supplierRewardCatalogueItem.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ rewards: items.map(serializeSupplierRewardCatalogueItem) });
}
