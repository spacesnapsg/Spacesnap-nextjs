import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { getAdminNotifications } from "@/lib/admin-notifications";

// System-admin-only. Backs the admin Notifications page — active/archived
// toggle + 10/page pagination (getAdminNotifications).
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") === "archived" ? "archived" : "active";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const { notifications, meta } = await getAdminNotifications({ status, page });
  return NextResponse.json({ notifications, meta });
}
