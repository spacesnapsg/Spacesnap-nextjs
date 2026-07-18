import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { serializeBooking } from "@/lib/bookings";

const BOOKING_STATUSES = new Set<string>(Object.values(BookingStatus));

// Mirrors old SupplierBookingController::index — company-scoped, optional
// status filter.
export async function GET(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !BOOKING_STATUSES.has(status)) {
    return NextResponse.json(
      { message: "status must be one of pending, confirmed, active, completed, cancelled." },
      { status: 422 }
    );
  }

  const bookings = await prisma.booking.findMany({
    where: {
      listing: { companyId: auth.companyId },
      ...(status ? { status: status as BookingStatus } : {}),
    },
    include: { listing: { include: { requiredCertificates: { include: { certificate: true } } } }, user: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bookings: bookings.map(serializeBooking) });
}
