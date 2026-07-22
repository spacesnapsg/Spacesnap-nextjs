import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { resolveRewardRedemption, RewardRedemptionResolutionError, serializeRewardRedemption } from "@/lib/reward-redemptions";

// System-admin-only. Resolves a pending pitch_ticket/consultancy redemption
// once the admin has arranged (or failed to arrange) it with the user's
// chosen partner — see RewardRedemptionStatus's own schema comment.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const redemptionId = parseBigIntParam(id);
  if (redemptionId === null) return notFoundResponse("Redemption not found.");

  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
  if (status !== "used" && status !== "cancelled") {
    return validationErrorResponse(new ApiValidationError({ status: ['status must be "used" or "cancelled".'] }));
  }

  try {
    const redemption = await resolveRewardRedemption(redemptionId, status);
    return NextResponse.json({ redemption: serializeRewardRedemption(redemption) });
  } catch (error) {
    if (error instanceof RewardRedemptionResolutionError) {
      if (error.reason === "not_found") return notFoundResponse(error.message);
      return validationErrorResponse(new ApiValidationError({ status: [error.message] }));
    }
    throw error;
  }
}
