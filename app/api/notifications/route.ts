import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { getNotifications, serializeNotification } from "@/lib/notifications";

// The caller's own notifications, pinned first — see getNotifications'
// own comment on the sort order. Replaces components/NotificationsPanel.tsx's
// MOCK_NOTIFICATIONS.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const notifications = await getNotifications(session.user.id);
  return NextResponse.json({ notifications: notifications.map(serializeNotification) });
}
