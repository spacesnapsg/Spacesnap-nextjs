import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sgdToCredits } from "@/lib/credit-units";

export interface BookingActivityLine {
  id: string;
  bookedByName: string;
  bookedByEmail: string;
  listingName: string;
  bookingType: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  credits: number;
}

export interface BookingActivityReport {
  from: Date | null;
  to: Date | null;
  totalBookings: number;
  totalCredits: number;
  lines: BookingActivityLine[];
}

// "Booking activity" = when the booking was made (createdAt), not the stay
// dates (startDate/endDate) — matches the Recent Activity feed's own
// booking_created semantics (lib/hooks/useActivity.ts) so a report for
// "last 7 days" shows the same set of bookings an admin would see there.
export async function getBookingActivityReport(from: Date | null, to: Date | null): Promise<BookingActivityReport> {
  const where: Prisma.BookingWhereInput = {};
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      listing: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const lines: BookingActivityLine[] = bookings.map((booking) => {
    const durationDays =
      Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      id: booking.id.toString(),
      bookedByName: booking.user.name,
      bookedByEmail: booking.user.email,
      listingName: booking.listing.name,
      bookingType: booking.bookingType,
      startDate: booking.startDate,
      endDate: booking.endDate,
      durationDays,
      credits: sgdToCredits(Number(booking.sgdAmount)),
    };
  });

  const totalCredits = lines.reduce((sum, line) => sum + line.credits, 0);

  return {
    from,
    to,
    totalBookings: lines.length,
    totalCredits,
    lines,
  };
}
