import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { createAnnouncement, getAnnouncementHistory, serializeAnnouncementSummary } from "@/lib/announcements";

// Admin's own send history — see getAnnouncementHistory's own comment.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const announcements = await getAnnouncementHistory();
  return NextResponse.json({ announcements });
}

export async function POST(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ message: ["message is required."] }));
  }

  try {
    const record = body as Record<string, unknown>;
    const announcement = await createAnnouncement({
      title: typeof record.title === "string" ? record.title : null,
      message: typeof record.message === "string" ? record.message : "",
      targetMembers: record.targetMembers === true,
      targetSuppliers: record.targetSuppliers === true,
      createdByUserId: auth.userId,
    });

    return NextResponse.json({ announcement: serializeAnnouncementSummary(announcement) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
