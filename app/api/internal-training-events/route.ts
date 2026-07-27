import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse } from "@/lib/api-errors";
import { listParticipantEvents, serializeInternalTrainingEvent } from "@/lib/internal-training-events";

// Participant-side: every internal training event the caller is a
// participant in (any authenticated user — participation isn't
// CA/admin-gated, unlike app/api/buyer-organization/internal-training-events).
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const events = await listParticipantEvents(session.user.id);
  return NextResponse.json({ events: events.map(serializeInternalTrainingEvent) });
}
