import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";
import { serializeRewardRedemption } from "@/lib/reward-redemptions";

// The caller's own redemption history — backs RewardsCatalogueModal's "View
// redeemed rewards" list, previously PLACEHOLDER_ACTIVE_VOUCHERS.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const redemptions = await prisma.rewardRedemption.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ redemptions: redemptions.map(serializeRewardRedemption) });
}
