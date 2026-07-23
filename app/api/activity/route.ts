import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { getUserActivity, parseActivityQuery, serializeActivityLogEntry } from "@/lib/activity";

// GET: the caller's own activity_log feed, paginated (10/page by default).
// Closes Sprint 4.5's "add an activity_log read endpoint" item — every write
// site (lib/bookings.ts, lib/bulk-orders.ts, lib/wallet.ts, lib/check-ins.ts,
// lib/training-*.ts, lib/certificate-signoffs.ts, lib/quiz-attempts.ts,
// lib/purchases.ts) has been writing rows since Sprint 3.5 with nothing to
// read them back. `?types=booking_created,booking_confirmed`,
// `?from=`/`?to=` (ISO dates), and `?page=`/`?pageSize=` back the user
// dashboard's category filter pills, date-range picker, and page controls
// respectively — all optional (omitting each means "every type"/"all
// time"/page 1 of 10).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  let query;
  try {
    query = parseActivityQuery(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const { items, total, page, pageSize } = await getUserActivity(session.user.id, query);

  return NextResponse.json({
    activity: items.map(serializeActivityLogEntry),
    meta: { page, pageSize, total },
  });
}
