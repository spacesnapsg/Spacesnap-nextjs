import { auth } from "@/auth";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-errors";

// Mirrors the old `supplier` middleware (EnsureUserIsSupplier: is_supplier
// only, not company-admin) plus the company-scoping every supplier route
// needs. No middleware.ts/route-group guard exists yet in this rewrite (see
// CLAUDE1.md, "Sprint 3, Session 2" — tracked as a Sprint 4 item), so each
// supplier route checks this itself, same as every other route so far.
export async function requireSupplier() {
  const session = await auth();
  if (!session?.user) {
    return { error: unauthorizedResponse() } as const;
  }
  if (!session.user.isSupplier) {
    return { error: forbiddenResponse("This action requires supplier access.") } as const;
  }
  if (!session.user.companyId) {
    return { error: forbiddenResponse("Your account is not associated with a company.") } as const;
  }

  return { companyId: BigInt(session.user.companyId), userId: session.user.id } as const;
}

// Company-admin-only actions (e.g. editing the company's business/finance
// details) — a stricter check than requireSupplier(), which any supplier at
// the company passes. Mirrors the isCompanyAdmin flag already used by
// RoleGuard/route.ts checks elsewhere, just enforced server-side here.
export async function requireCompanyAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: unauthorizedResponse() } as const;
  }
  if (!session.user.isCompanyAdmin) {
    return { error: forbiddenResponse("This action requires company admin access.") } as const;
  }
  if (!session.user.companyId) {
    return { error: forbiddenResponse("Your account is not associated with a company.") } as const;
  }

  return { companyId: BigInt(session.user.companyId), userId: session.user.id } as const;
}
