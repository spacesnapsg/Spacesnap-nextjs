import { NextRequest, NextResponse } from "next/server";
import { requireBuyerOrgMember } from "@/lib/buyer-org-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { createTopUp, parseTopUpFields, serializeTopUp } from "@/lib/wallet";
import { StripeChargeFailedError } from "@/lib/stripe";

// POST: top up the caller's OWN buyer organization's shared pool — any
// member may do this (product owner: "any member tops up the pool"), not
// just the admin. Same real-Stripe-charge discipline as POST /api/wallet/topup
// (createTopUp, lib/wallet.ts), just stamped with buyerOrganizationId so it
// lands in the pool instead of the caller's personal wallet.
// buyerOrganizationId always comes from the caller's own session, never the
// request body — a member must never be able to fund an org they don't
// belong to.
export async function POST(request: NextRequest) {
  const authResult = await requireBuyerOrgMember();
  if ("error" in authResult) return authResult.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let amount, paymentMethodId;
  try {
    ({ amount, paymentMethodId } = parseTopUpFields(body));
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    const result = await createTopUp(authResult.userId, amount, paymentMethodId, authResult.buyerOrganizationId);
    return NextResponse.json(serializeTopUp(result), { status: 201 });
  } catch (error) {
    if (error instanceof StripeChargeFailedError) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }
    throw error;
  }
}
