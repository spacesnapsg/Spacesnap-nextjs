import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

// The caller's own organization + role, or null if they aren't in one yet —
// the user Financials page reads this to decide between the join prompt and
// the org card (lib/buyer-organizations.ts backs the actual membership logic).
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  if (!session.user.buyerOrganizationId) {
    const pending = await prisma.buyerOrganizationJoinRequest.findFirst({
      where: { requestedByUserId: session.user.id, status: "pending" },
      include: { buyerOrganization: { select: { name: true } } },
    });
    return NextResponse.json({
      organization: null,
      pendingRequest: pending ? { organizationName: pending.buyerOrganization.name } : null,
    });
  }

  const buyerOrganizationId = BigInt(session.user.buyerOrganizationId);
  const [org, existingAdmin, currentUser] = await Promise.all([
    prisma.buyerOrganization.findUnique({ where: { id: buyerOrganizationId } }),
    prisma.user.findFirst({
      where: { buyerOrganizationId, isBuyerOrgAdmin: true },
      select: { name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { buyerOrgPromotionRequested: true },
    }),
  ]);
  if (!org) return NextResponse.json({ organization: null });

  return NextResponse.json({
    organization: {
      id: org.id.toString(),
      name: org.name,
      isAdmin: session.user.isBuyerOrgAdmin,
      adminName: existingAdmin?.name ?? null,
      promotionRequested: currentUser.buyerOrgPromotionRequested,
    },
  });
}
