"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getRoleHome } from "@/lib/role-home";

type Guard = "user" | "supplier" | "systemAdmin";

// Client-side companion to the per-route `requireSupplier`/`requireSystemAdmin`
// checks already enforced by the API routes (CODEBASE_SUMMARY.md flagged the
// old frontend as having no client role-gating on User/Supplier routes — this
// closes that gap). Server-side route-group protection (middleware.ts) is
// still a separate Sprint 4 item (see CLAUDE1.md, "Sprint 3, Session 2"); this
// only stops an unauthorized user from seeing a role-gated page's UI, it
// doesn't replace the API's own checks.
export default function RoleGuard({
  guard,
  children,
}: {
  guard: Guard;
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user;

  const allowed =
    status === "authenticated" &&
    !!user &&
    ((guard === "user" && user.isMember) ||
      (guard === "supplier" && user.isSupplier) ||
      (guard === "systemAdmin" && user.isSystemAdmin));

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (!allowed && user) {
      router.replace(getRoleHome(user));
    }
  }, [status, allowed, user, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
