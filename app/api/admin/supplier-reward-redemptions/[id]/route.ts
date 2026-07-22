import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  resolveSupplierRewardRedemption,
  SupplierRewardRedemptionResolutionError,
  serializeSupplierRewardRedemption,
} from "@/lib/supplier-reward-redemptions";

// System-admin-only. Resolves a pending report/ad redemption once the admin
// has generated the report / arranged the ad placement (or failed to).
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
    const redemption = await resolveSupplierRewardRedemption(redemptionId, status);
    return NextResponse.json({ redemption: serializeSupplierRewardRedemption(redemption) });
  } catch (error) {
    if (error instanceof SupplierRewardRedemptionResolutionError) {
      if (error.reason === "not_found") return notFoundResponse(error.message);
      return validationErrorResponse(new ApiValidationError({ status: [error.message] }));
    }
    throw error;
  }
}
