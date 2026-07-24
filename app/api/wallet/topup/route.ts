import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { createTopUp, parseTopUpFields, serializeTopUp } from "@/lib/wallet";
import { StripeChargeFailedError } from "@/lib/stripe";

// POST: top up the caller's own credit wallet. F4 (2026-07-25): a real Stripe
// card charge now backs the credit — the body carries a `paymentMethodId`
// (pm_... from Stripe Elements) and the credit is only written after the
// charge succeeds (see createTopUp, lib/wallet.ts).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

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
    const result = await createTopUp(session.user.id, amount, paymentMethodId);
    return NextResponse.json(serializeTopUp(result), { status: 201 });
  } catch (error) {
    if (error instanceof StripeChargeFailedError) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }
    throw error;
  }
}
