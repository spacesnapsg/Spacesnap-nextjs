import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse } from "@/lib/api-errors";
import { getPendingResolutionBookings, serializeBooking, serializeBookingCredit } from "@/lib/bookings";

// Powers both the "your booking was cancelled" login modal and the pinned
// notification's data — the caller's own bookings still awaiting a
// refund-or-rebook resolution (status declined_pending_resolution), each
// paired with its still-available BookingCredit. Lazily sweeps the caller's
// own overdue credits first (see getPendingResolutionBookings's own
// comment) — a dev-time safety net, not the real 1-week guarantee, which is
// POST /api/cron/resolve-pending-booking-credits.
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const bookings = await getPendingResolutionBookings(session.user.id);
  const credits = await prisma.bookingCredit.findMany({
    where: { sourceBookingId: { in: bookings.map((b) => b.id) }, status: "available" },
  });
  const creditByBookingId = new Map(credits.map((c) => [c.sourceBookingId.toString(), c]));

  return NextResponse.json({
    bookings: bookings.map((booking) => ({
      ...serializeBooking(booking),
      credit: creditByBookingId.has(booking.id.toString())
        ? serializeBookingCredit(creditByBookingId.get(booking.id.toString())!)
        : null,
    })),
  });
}
