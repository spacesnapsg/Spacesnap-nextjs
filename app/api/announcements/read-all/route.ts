import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { markAllAnnouncementsRead } from "@/lib/announcements";

export async function PATCH() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  await markAllAnnouncementsRead(session.user.id, {
    isMember: session.user.isMember,
    isSupplier: session.user.isSupplier,
  });
  return NextResponse.json({ ok: true });
}
