import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { getNotifications, getNotificationsPage, serializeNotification } from "@/lib/notifications";

// The caller's own notifications, pinned first — see getNotifications'
// own comment on the sort order. Replaces components/NotificationsPanel.tsx's
// MOCK_NOTIFICATIONS.
//
// No `page` query param: unpaginated, unarchived-only list for the navbar
// bell dropdown (small scale assumption already established there). With a
// `page` param: the paginated Active/Archived feed backing the full
// /notifications page, same shape as GET /api/admin/notifications.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  if (pageParam === null) {
    const notifications = await getNotifications(session.user.id);
    return NextResponse.json({ notifications: notifications.map(serializeNotification) });
  }

  const status = searchParams.get("status") === "archived" ? "archived" : "active";
  const page = Math.max(1, Number(pageParam) || 1);
  const { notifications, meta } = await getNotificationsPage(session.user.id, { status, page });
  return NextResponse.json({ notifications, meta });
}
