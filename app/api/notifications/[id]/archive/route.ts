import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { setNotificationArchived, NotificationNotFoundError } from "@/lib/notifications";

// Body: { isArchived: boolean } — toggles both ways so the archive icon in
// the Archived view can restore back to Active. Mirrors
// /api/admin/notifications/[id]/archive, scoped to the caller's own rows.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const notificationId = parseBigIntParam(id);
  if (notificationId === null) return notFoundResponse("Notification not found.");

  const body = await request.json().catch(() => null);
  const isArchived = body?.isArchived !== false;

  try {
    await setNotificationArchived(session.user.id, notificationId, isArchived);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) return notFoundResponse(error.message);
    throw error;
  }

  return NextResponse.json({ success: true });
}
