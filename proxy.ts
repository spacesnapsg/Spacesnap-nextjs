import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRoleHome } from "@/lib/role-home";

// Server-side companion to components/RoleGuard.tsx (client-side only, can't
// be trusted as the actual boundary — see CLAUDE1.md "Sprint 3, Session 2").
// Next.js 16 renamed the middleware.ts convention to proxy.ts (still runs on
// the Node.js runtime by default, so `auth()`'s Prisma-backed jwt callback
// works here the same as in a Server Component/Route Handler).
const USER_ROUTES = ["/user", "/marketplace", "/passport", "/wallet"];
const SUPPLIER_ROUTES = [
  "/supplier",
  "/supplier-inventory",
  "/supplier-profile",
  "/supplier-requests",
  "/supplier-tutorials",
];
const ADMIN_ROUTES = [
  "/admin",
  "/admin-approvals",
  "/admin-companies",
  "/admin-financials",
  "/admin-users",
];

function matchesAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isUserRoute = matchesAny(pathname, USER_ROUTES);
  const isSupplierRoute = matchesAny(pathname, SUPPLIER_ROUTES);
  const isAdminRoute = matchesAny(pathname, ADMIN_ROUTES);

  if (!isUserRoute && !isSupplierRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  const allowed =
    isUserRoute ||
    (isSupplierRoute && session.user.isSupplier) ||
    (isAdminRoute && session.user.isSystemAdmin);

  if (!allowed) {
    return NextResponse.redirect(new URL(getRoleHome(session.user), req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/user/:path*",
    "/marketplace/:path*",
    "/passport/:path*",
    "/wallet/:path*",
    "/supplier/:path*",
    "/supplier-inventory/:path*",
    "/supplier-profile/:path*",
    "/supplier-requests/:path*",
    "/supplier-tutorials/:path*",
    "/admin/:path*",
    "/admin-approvals/:path*",
    "/admin-companies/:path*",
    "/admin-financials/:path*",
    "/admin-users/:path*",
  ],
};
