import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { getAnnouncementsForUser } from "@/lib/announcements";

// The caller's own eligible broadcasts (matching their isMember/isSupplier
// roles), each with its own per-user isRead — merged client-side into
// NotificationsPanel's feed alongside GET /api/notifications.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const announcements = await getAnnouncementsForUser(session.user.id, {
    isMember: session.user.isMember,
    isSupplier: session.user.isSupplier,
  });
  return NextResponse.json({ announcements });
}
