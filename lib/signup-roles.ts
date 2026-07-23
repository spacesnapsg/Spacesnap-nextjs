export type SignupRole = "member" | "supplier" | "both";

export const SIGNUP_ROLES: ReadonlySet<SignupRole> = new Set(["member", "supplier", "both"]);

export function parseSignupRole(value: unknown): SignupRole | null {
  return typeof value === "string" && SIGNUP_ROLES.has(value as SignupRole) ? (value as SignupRole) : null;
}

// 2026-07-23 — the Member/Supplier/Both signup choice is now exclusive: a
// "Supplier" role account gets isMember=false and loses access to the
// user-side routes entirely (enforced in proxy.ts/RoleGuard.tsx), not just
// isSupplier=false the way it used to be additive-only. No role selected
// (null — legacy/API-only registration) defaults to true, same permissive
// posture as every pre-existing row (User.isMember's own schema default).
export function resolveIsMember(role: SignupRole | null): boolean {
  return role !== "supplier";
}
