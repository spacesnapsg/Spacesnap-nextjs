import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse } from "@/lib/api-errors";
import { serializeAdminUser } from "@/lib/admin-users";

// Platform-wide reinstate — see the suspend route for the enforcement note.
// Mirrors old UserController::reinstate.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFoundResponse("User not found.");

  const user = await prisma.user.update({
    where: { id },
    data: { status: "active" },
    include: { company: true },
  });

  return NextResponse.json({ user: serializeAdminUser(user) });
}
