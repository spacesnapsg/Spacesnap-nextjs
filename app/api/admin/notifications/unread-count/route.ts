import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// System-admin-only. Powers the unread badge on the navbar hamburger menu —
// deliberately a separate cheap count endpoint rather than piggybacking on
// GET /api/admin/notifications, since the badge needs to stay accurate
// regardless of which page/view (active vs. archived) the admin currently
// has open. Archived notifications don't count toward this — archiving is
// how an admin "dismisses" one for good.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const count = await prisma.adminNotification.count({ where: { isRead: false, isArchived: false } });
  return NextResponse.json({ count });
}
