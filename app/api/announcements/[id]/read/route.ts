import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { markAnnouncementRead } from "@/lib/announcements";

// Idempotent upsert (see markAnnouncementRead) — unlike
// PATCH /api/notifications/[id]/read, there's no "not found" case to catch
// here beyond an unparseable id, since re-marking an already-read
// announcement (or one the caller was never targeted by — the upsert just
// creates a harmless read record) is a safe no-op, not an error.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const announcementId = parseBigIntParam(id);
  if (announcementId === null) return notFoundResponse("Announcement not found.");

  await markAnnouncementRead(session.user.id, announcementId);
  return NextResponse.json({ ok: true });
}
