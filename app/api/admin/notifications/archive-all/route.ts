import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { archiveAllAdminNotifications } from "@/lib/admin-notifications";

// System-admin-only. Archives every currently-active notification — the
// page's "Archive all" action. Not reversible in bulk (restoring is still
// per-row from the Archived view, same as archiving one at a time).
export async function PATCH() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  await archiveAllAdminNotifications();
  return NextResponse.json({ success: true });
}
