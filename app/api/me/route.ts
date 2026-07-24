import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { getUserRewardTier } from "@/lib/reward-tiers";
import { sgdToCredits } from "@/lib/credit-units";
import { updateUserProfile } from "@/lib/user-profile";

// GET: the caller's own profile. Sprint 4.5 addition — the JWT session only
// carries role-gating fields (see types/next-auth.d.ts), not display fields
// like title/avatarUrl/company name, and there was no other route exposing
// them for profile-card UI (e.g. the Digital Passport page).
//
// `rewardTier`/`referralCode` added Sprint 6.5 (User Reward Tier). rewardTier
// is a structured object (tier name, rebate %, progress-to-next-tier in
// credits) — never a bare balance, same compliance framing
// lib/earned-balance-guard.test.ts already enforces for earned credits (see
// getUserRewardTier's comment, lib/reward-tiers.ts). Reusing this existing
// route rather than adding a new one.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { company: { select: { name: true } } },
  });
  if (!user) return unauthorizedResponse();

  const rewardTier = await getUserRewardTier(user.id);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    avatarUrl: user.avatarUrl,
    companyName: user.company?.name ?? null,
    memberSince: user.createdAt.toISOString(),
    promotionRequested: user.promotionRequested,
    referralCode: user.referralCode,
    rewardTier: {
      tier: rewardTier.tier,
      rebatePercent: rewardTier.rebatePercent,
      bookingCount: rewardTier.bookingCount,
      spendCredits: sgdToCredits(rewardTier.spendSgd),
      nextTier: rewardTier.nextTier,
      bookingsToNextTier: rewardTier.bookingsToNextTier,
      spendCreditsToNextTier:
        rewardTier.spendSgdToNextTier !== null ? sgdToCredits(rewardTier.spendSgdToNextTier) : null,
      progressPercent: rewardTier.progressPercent,
      // 2026-07-22 fulfillment session — a redeemed Premium Tier Upgrade
      // (rewards catalogue) bumps `tier`/`rebatePercent` above one level for
      // its duration; baseTier is what the live rolling-window computation
      // alone would show, for the UI to explain the boost ("Starter,
      // boosted from Free until 12 Oct").
      baseTier: rewardTier.baseTier,
      tierUpgradeActive: rewardTier.tierUpgradeActive,
      tierUpgradeExpiresAt: rewardTier.tierUpgradeExpiresAt ? rewardTier.tierUpgradeExpiresAt.toISOString() : null,
    },
  });
}

// PATCH: update the caller's own display fields (name/title/avatarUrl) —
// backs the Digital Passport and Supplier Profile "Edit Profile" cards,
// both previously fake-saving with no backend at all (2026-07-24 pre-UAT
// audit finding). See lib/user-profile.ts for the update itself.
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  const name = body && typeof body === "object" ? (body as Record<string, unknown>).name : undefined;
  const title = body && typeof body === "object" ? (body as Record<string, unknown>).title : undefined;
  const avatarUrl = body && typeof body === "object" ? (body as Record<string, unknown>).avatarUrl : undefined;

  try {
    const user = await updateUserProfile(session.user.id, {
      name: typeof name === "string" ? name : "",
      title: typeof title === "string" ? title : null,
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
    });
    return NextResponse.json({ name: user.name, title: user.title, avatarUrl: user.avatarUrl });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
