import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { createTopUp, parseTopUpFields, serializeTopUp } from "@/lib/wallet";

// POST: top up the caller's own credit wallet. Sprint 3.5 known-gap #5 —
// see lib/wallet.ts for why this creates a `type: topup` Transaction (not
// `purchase`, which lib/bulk-orders.ts already covers) and why no Stripe
// charge happens here yet (Sprint 6, unbuilt).
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let amount;
  try {
    amount = parseTopUpFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const result = await createTopUp(session.user.id, amount);

  return NextResponse.json(serializeTopUp(result), { status: 201 });
}
