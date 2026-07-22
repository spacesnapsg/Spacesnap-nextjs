import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { listAvailableRewardGrants, serializeRewardGrant } from "@/lib/reward-grants";

// The caller's own available (unexpired) RewardGrant rows — 2026-07-22
// fulfillment session, closes the standing "no endpoint exists to list a
// user's own available RewardGrant rows" gap (SPRINT_PLAN_NEXTJS_REWRITE.md
// Sprint 6.10). Backs the "Have a voucher?" checkout dropdown in
// BookingModal — a redeemed Discount Voucher only becomes visible here.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const grants = await listAvailableRewardGrants(session.user.id);
  return NextResponse.json({ grants: grants.map(serializeRewardGrant) });
}
