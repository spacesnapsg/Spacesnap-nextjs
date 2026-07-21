import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { markNotificationRead, NotificationNotFoundError } from "@/lib/notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const notificationId = parseBigIntParam(id);
  if (notificationId === null) return notFoundResponse("Notification not found.");

  try {
    await markNotificationRead(session.user.id, notificationId);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) return notFoundResponse(error.message);
    throw error;
  }

  return NextResponse.json({ ok: true });
}
