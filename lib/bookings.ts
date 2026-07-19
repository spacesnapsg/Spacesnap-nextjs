import { BookingType, type Booking, type Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { getMissingCertificates } from "@/lib/certificate-gating";

const BOOKING_TYPES = new Set<string>(Object.values(BookingType));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bookingWithRelationsArgs = {
  include: { listing: { include: { requiredCertificates: { include: { certificate: true } } } }, user: true },
} satisfies Prisma.BookingDefaultArgs;

export type BookingWithRelations = Prisma.BookingGetPayload<typeof bookingWithRelationsArgs>;

export function serializeBooking(booking: Booking | BookingWithRelations) {
  return {
    id: booking.id.toString(),
    userId: booking.userId,
    listingId: booking.listingId.toString(),
    bookingType: booking.bookingType,
    startDate: booking.startDate.toISOString().slice(0, 10),
    endDate: booking.endDate.toISOString().slice(0, 10),
    credits: Number(booking.credits),
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    ...("listing" in booking
      ? {
          listingName: booking.listing.name,
          requiredCertificates: booking.listing.requiredCertificates.map((r) => ({
            certificateId: r.certificate.id.toString(),
            certificateName: r.certificate.name,
          })),
        }
      : {}),
    ...("user" in booking ? { userName: booking.user.name, userEmail: booking.user.email } : {}),
  };
}

interface ParsedBookingFields {
  listingId: bigint;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Mirrors old BookingController::store's validation rules.
export function parseBookingCreateFields(body: unknown): ParsedBookingFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let listingId: bigint | null = null;
  const rawListingId = typeof b.listingId === "number" ? String(b.listingId) : b.listingId;
  if (typeof rawListingId !== "string" || !/^\d+$/.test(rawListingId)) {
    errors.listingId = ["listingId is required."];
  } else {
    listingId = BigInt(rawListingId);
  }

  if (typeof b.bookingType !== "string" || !BOOKING_TYPES.has(b.bookingType)) {
    errors.bookingType = ["bookingType must be one of daily, weekly, monthly."];
  }

  if (!isDateString(b.startDate)) {
    errors.startDate = ["startDate is required."];
  }

  if (!isDateString(b.endDate)) {
    errors.endDate = ["endDate is required."];
  } else if (isDateString(b.startDate) && Date.parse(b.endDate as string) < Date.parse(b.startDate as string)) {
    errors.endDate = ["endDate must be on or after startDate."];
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return {
    listingId: listingId!,
    bookingType: b.bookingType as BookingType,
    startDate: b.startDate as string,
    endDate: b.endDate as string,
  };
}

// Fetches the required/held certificate ids and delegates the actual gating
// decision (required minus held-and-not-expired) to the pure set-difference
// module — see lib/certificate-gating.ts. Mirrors BookingController::store
// and SupplierBookingController's shared missing-certificate check.
export async function missingCertificateIds(listingId: bigint, userId: string): Promise<bigint[]> {
  const [required, held] = await Promise.all([
    prisma.listingRequiredCertificate.findMany({ where: { listingId }, select: { certificateId: true } }),
    prisma.userCertificate.findMany({
      where: { userId },
      select: { certificateId: true, expiryDate: true },
    }),
  ]);

  const missingIds = new Set(
    getMissingCertificates(
      required.map((r) => r.certificateId.toString()),
      held.map((h) => ({ certificateId: h.certificateId.toString(), expiryDate: h.expiryDate }))
    )
  );
  return required.map((r) => r.certificateId).filter((id) => missingIds.has(id.toString()));
}
