import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";
import { serializeRewardCatalogueItem } from "@/lib/reward-catalogue";

// Any authenticated user — the active rewards catalogue, consumed by
// RewardsCatalogueModal instead of its old hardcoded CATALOGUE_REWARDS
// array (Sprint 6.9). Inactive items are never returned here.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const items = await prisma.rewardCatalogueItem.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ rewards: items.map(serializeRewardCatalogueItem) });
}
