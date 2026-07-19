import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";

// GET: the caller's own profile. Sprint 4.5 addition — the JWT session only
// carries role-gating fields (see types/next-auth.d.ts), not display fields
// like title/avatarUrl/company name, and there was no other route exposing
// them for profile-card UI (e.g. the Digital Passport page).
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { company: { select: { name: true } } },
  });
  if (!user) return unauthorizedResponse();

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title,
    avatarUrl: user.avatarUrl,
    companyName: user.company?.name ?? null,
    memberSince: user.createdAt.toISOString(),
  });
}
