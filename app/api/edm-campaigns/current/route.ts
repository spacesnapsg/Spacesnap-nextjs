import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { getActiveEdmForUser } from "@/lib/edm-campaigns";

// null means "don't show the popup" — either nothing eligible targets this
// user, or lastEdmSeenAt is too recent (see getActiveEdmForUser's own
// trigger-condition comment).
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastEdmSeenAt: true },
  });
  if (!user) return unauthorizedResponse();

  const campaign = await getActiveEdmForUser({
    id: session.user.id,
    isMember: session.user.isMember,
    isSupplier: session.user.isSupplier,
    lastEdmSeenAt: user.lastEdmSeenAt,
  });

  return NextResponse.json({ campaign });
}
