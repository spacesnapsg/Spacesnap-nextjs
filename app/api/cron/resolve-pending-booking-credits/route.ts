import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sweepOverdueBookingCredits } from "@/lib/bookings";
import { sweepExpiringCertificateNotifications } from "@/lib/notifications";

// Server-to-server only — there is no logged-in user making this request
// (same "not a session cookie" posture as the Stripe webhook route), so it's
// authenticated by a shared secret instead. This is what actually guarantees
// the BOOKING_CREDIT_REFUND_OBLIGATION_DAYS (7-day) forced refund fires even
// for a user who never logs back in at all — GET /api/bookings/pending-resolution's
// own lazy sweep only covers a user who's actively looking, which is a dev-time
// safety net, not the real guarantee (see that route's own comment).
//
// Also sweeps expiring-certificate notifications (lib/notifications.ts) —
// unrelated to BookingCredit, but the same daily cadence, and this is the
// only scheduled entry point this codebase has, so both sweeps share it
// rather than each inventing separate cron infra.
//
// Requires actual scheduling infra outside this repo — this codebase has no
// cron of its own (confirmed: every other time-based expiry here, e.g.
// CreditHold's 7-day hold, is a lazy check on read, precisely because nothing
// else needed a hard, log-in-independent deadline before this feature).
// Railway's "Cron Schedule" service setting (a separate service in the same
// project, configured to POST here daily with the CRON_SECRET header) is the
// intended trigger — that dashboard configuration is outside what this
// session can provision and still needs to be set up manually.
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!provided) return false;

  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);
  if (secretBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(secretBuf, providedBuf);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const bookingCredits = await sweepOverdueBookingCredits();
  const certExpiryNotifications = await sweepExpiringCertificateNotifications();
  return NextResponse.json({ bookingCredits, certExpiryNotifications });
}
