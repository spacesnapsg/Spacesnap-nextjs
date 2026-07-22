import { NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { InsufficientCreditBalanceError } from "@/lib/credits";
import {
  redeemSupplierRewardCatalogueItem,
  SupplierRewardRedemptionError,
  serializeSupplierRewardRedemption,
} from "@/lib/supplier-reward-redemptions";

// Any company member — spend the company's own earned_rebate credits on a
// catalogue item. See lib/supplier-reward-redemptions.ts for the atomic
// capacity/balance guard.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const itemId = parseBigIntParam(id);
  if (itemId === null) return notFoundResponse("Reward not found.");

  try {
    const redemption = await redeemSupplierRewardCatalogueItem(auth.companyId, auth.userId, itemId);
    return NextResponse.json({ redemption: serializeSupplierRewardRedemption(redemption) }, { status: 201 });
  } catch (error) {
    if (error instanceof SupplierRewardRedemptionError) {
      if (error.reason === "not_found") return notFoundResponse(error.message);
      return validationErrorResponse(new ApiValidationError({ reward: [error.message] }));
    }
    if (error instanceof InsufficientCreditBalanceError) {
      return validationErrorResponse(
        new ApiValidationError({ reward: ["Your company doesn't have enough earned credits to redeem this reward."] })
      );
    }
    throw error;
  }
}
