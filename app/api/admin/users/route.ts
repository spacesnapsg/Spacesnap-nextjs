import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { roleWhereClause, serializeAdminUser, USER_ROLES, type UserRole } from "@/lib/admin-users";

const PER_PAGE = 15;

// Platform-wide user list, not scoped to the caller's own company — a
// System Admin can see every user regardless of role (see Sprint 3 Session 4
// scope note on admin breadth). Mirrors old UserController::index.
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  if (role && !USER_ROLES.has(role)) {
    return NextResponse.json(
      { message: "role must be one of system_admin, company_admin, supplier, user." },
      { status: 422 }
    );
  }

  const where: Prisma.UserWhereInput = {
    ...(role ? roleWhereClause(role as UserRole) : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { company: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map(serializeAdminUser),
    meta: { page, perPage: PER_PAGE, total },
  });
}
