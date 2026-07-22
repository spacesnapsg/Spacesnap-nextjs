import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { InsufficientCreditBalanceError } from "@/lib/credits";
import { redeemRewardCatalogueItem, RewardRedemptionError, serializeRewardRedemption } from "@/lib/reward-redemptions";

// Any authenticated user — spend earned credits on a catalogue item. See
// lib/reward-redemptions.ts for the atomic capacity/balance guard.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const itemId = parseBigIntParam(id);
  if (itemId === null) return notFoundResponse("Reward not found.");

  try {
    const redemption = await redeemRewardCatalogueItem(session.user.id, itemId);
    return NextResponse.json({ redemption: serializeRewardRedemption(redemption) }, { status: 201 });
  } catch (error) {
    if (error instanceof RewardRedemptionError) {
      if (error.reason === "not_found") return notFoundResponse(error.message);
      return validationErrorResponse(new ApiValidationError({ reward: [error.message] }));
    }
    if (error instanceof InsufficientCreditBalanceError) {
      return validationErrorResponse(
        new ApiValidationError({ reward: ["You don't have enough earned credits to redeem this reward."] })
      );
    }
    throw error;
  }
}
