import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { serializeSupplierRewardRedemption } from "@/lib/supplier-reward-redemptions";

// The caller's own company's redemption history — backs
// SupplierRewardsCatalogueModal's "View redeemed rewards" list.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const redemptions = await prisma.supplierRewardRedemption.findMany({
    where: { companyId: auth.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ redemptions: redemptions.map(serializeSupplierRewardRedemption) });
}
