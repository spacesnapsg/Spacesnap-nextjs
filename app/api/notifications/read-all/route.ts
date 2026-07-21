import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function PATCH() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  await markAllNotificationsRead(session.user.id);
  return NextResponse.json({ ok: true });
}
