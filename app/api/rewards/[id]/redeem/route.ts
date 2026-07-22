import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { InsufficientCreditBalanceError } from "@/lib/credits";
import { redeemRewardCatalogueItem, RewardRedemptionError, serializeRewardRedemption } from "@/lib/reward-redemptions";

// Any authenticated user — spend earned credits on a catalogue item. See
// lib/reward-redemptions.ts for the atomic capacity/balance guard.
//
// 2026-07-22 fulfillment session: pitch_ticket/consultancy items require an
// optional-in-the-schema-but-actually-required `selectedPartnerOption` body
// field (validated against the item's own partnerOptions inside
// redeemRewardCatalogueItem, not here) — every other category ignores it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const itemId = parseBigIntParam(id);
  if (itemId === null) return notFoundResponse("Reward not found.");

  const body = await request.json().catch(() => null);
  const selectedPartnerOption =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).selectedPartnerOption === "string"
      ? ((body as Record<string, unknown>).selectedPartnerOption as string)
      : undefined;

  try {
    const redemption = await redeemRewardCatalogueItem(session.user.id, itemId, { selectedPartnerOption });
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
