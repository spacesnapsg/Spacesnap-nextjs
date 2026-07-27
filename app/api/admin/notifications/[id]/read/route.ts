import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { markAdminNotificationRead, AdminNotificationNotFoundError } from "@/lib/admin-notifications";

// System-admin-only. Body: { isRead: boolean } — toggles both ways so the
// mark-as-read icon can also mark-as-unread.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const notificationId = parseBigIntParam(id);
  if (notificationId === null) return notFoundResponse("Notification not found.");

  const body = await request.json().catch(() => null);
  const isRead = body?.isRead !== false;

  try {
    await markAdminNotificationRead(notificationId, isRead);
  } catch (error) {
    if (error instanceof AdminNotificationNotFoundError) return notFoundResponse(error.message);
    throw error;
  }

  return NextResponse.json({ success: true });
}
