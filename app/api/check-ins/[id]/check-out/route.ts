import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, notFoundResponse, unauthorizedResponse } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { BookingNotCheckOutableError, CheckInAlreadyCheckedOutError, checkOutCheckIn, serializeCheckIn } from "@/lib/check-ins";

// PATCH: check out an existing check-in belonging to the requesting user.
// Sprint 3.5 new schema item — flips an `active` booking to `completed` when
// the check-in is tied to one (see check_ins schema comment in schema.prisma).
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { id } = await params;
  const checkInId = parseBigIntParam(id);
  if (checkInId === null) return notFoundResponse("Check-in not found.");

  const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } });
  if (!checkIn) return notFoundResponse("Check-in not found.");
  if (checkIn.userId !== session.user.id) {
    return forbiddenResponse("You do not have access to this check-in.");
  }

  try {
    const updated = await checkOutCheckIn(checkInId);
    return NextResponse.json({ checkIn: serializeCheckIn(updated) });
  } catch (error) {
    if (error instanceof CheckInAlreadyCheckedOutError || error instanceof BookingNotCheckOutableError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }
    throw error;
  }
}
