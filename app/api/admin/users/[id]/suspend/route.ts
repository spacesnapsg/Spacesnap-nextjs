import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse } from "@/lib/api-errors";
import { serializeAdminUser } from "@/lib/admin-users";

// Platform-wide suspend — any user, any role, not scoped to the caller's own
// company. Mirrors old UserController::suspend.
//
// Enforcement: setting status=suspended here is not inert. auth.ts's `jwt`
// callback re-checks `status` from the DB on every session read and forces
// sign-out when suspended (see auth.ts:62-74) — so a suspended user is
// locked out of every route that calls auth() (login, /api/bookings,
// /api/certificates, everything built this session included) as soon as
// their current JWT is next read, not just at their next login. That closes
// the old build's "suspend does nothing" gap for every actor-side action.
// What's still open: listing visibility — a suspended supplier's listings
// stay visible to other browsing users, because Listing belongs to Company,
// not User, and there's no company-level suspension concept in this schema.
// Mapping "this user is suspended" to "hide these listings" is an undecided
// modeling question (whole company vs. just that user's own listings), not
// a one-line filter — deliberately left open rather than guessed at here.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFoundResponse("User not found.");

  const user = await prisma.user.update({
    where: { id },
    data: { status: "suspended" },
    include: { company: true },
  });

  return NextResponse.json({ user: serializeAdminUser(user) });
}
