import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { grantBookingCredit, serializeBookingCredit } from "@/lib/bookings";
import { creditsToSgd } from "@/lib/credit-units";

// Admin-only manual "goodwill" BookingCredit grant — the second (and only
// other) way a BookingCredit gets issued, besides a supplier decline. No
// real Stripe charge backs this money (refundObligated stays false inside
// grantBookingCredit), so it simply lapses if unused; no auto-gating logic,
// a manual admin decision with no automatic trigger.
export async function POST(request: Request) {
  const adminAuth = await requireSystemAdmin();
  if ("error" in adminAuth) return adminAuth.error;

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const errors: Record<string, string[]> = {};

  const userId = typeof b.userId === "string" && b.userId.length > 0 ? b.userId : null;
  if (!userId) errors.userId = ["userId is required."];

  const rawSourceBookingId = typeof b.sourceBookingId === "number" ? String(b.sourceBookingId) : b.sourceBookingId;
  let sourceBookingId: bigint | null = null;
  if (typeof rawSourceBookingId !== "string" || !/^\d+$/.test(rawSourceBookingId)) {
    errors.sourceBookingId = ["sourceBookingId is required."];
  } else {
    sourceBookingId = BigInt(rawSourceBookingId);
  }

  const rawAmount = typeof b.amount === "number" ? b.amount : Number(b.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    errors.amount = ["amount must be a positive number."];
  }

  if (Object.keys(errors).length > 0) {
    return validationErrorResponse(new ApiValidationError(errors));
  }

  try {
    // rawAmount is entered in "credits" (the same unit this route's own
    // response — via serializeBookingCredit — reports the grant back in),
    // converted to true SGD once here, at the write boundary.
    const credit = await grantBookingCredit({
      userId: userId!,
      sourceBookingId: sourceBookingId!,
      amount: new Prisma.Decimal(creditsToSgd(rawAmount)),
    });
    return NextResponse.json({ credit: serializeBookingCredit(credit) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
