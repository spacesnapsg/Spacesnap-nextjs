import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { markAllAdminNotificationsRead } from "@/lib/admin-notifications";

// System-admin-only. Marks every active (non-archived) unread notification
// as read in one go — the page's "Mark all as read" action.
export async function PATCH() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  await markAllAdminNotificationsRead();
  return NextResponse.json({ success: true });
}
