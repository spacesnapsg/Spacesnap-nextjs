import { auth } from "@/auth";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-errors";

// System Admin scope is platform-wide (see routes/api.php's `system_admin`
// middleware group in the old backend) — not scoped to a company, unlike
// requireSupplier(). No middleware.ts/route-group guard exists yet in this
// rewrite (tracked as a Sprint 4 item, see CLAUDE1.md "Sprint 3, Session 2"),
// so each admin route checks this itself, same pattern as requireSupplier().
export async function requireSystemAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: unauthorizedResponse() } as const;
  }
  if (!session.user.isSystemAdmin) {
    return { error: forbiddenResponse("This action requires system admin access.") } as const;
  }

  return { userId: session.user.id } as const;
}
