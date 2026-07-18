import type { Company, User } from "@/app/generated/prisma/client";

export type UserRole = "system_admin" | "company_admin" | "supplier" | "user";

const ROLE_FILTERS: Record<UserRole, (u: Pick<User, "isSupplier" | "isCompanyAdmin" | "isSystemAdmin">) => boolean> = {
  system_admin: (u) => u.isSystemAdmin,
  company_admin: (u) => u.isCompanyAdmin && !u.isSystemAdmin,
  supplier: (u) => u.isSupplier && !u.isCompanyAdmin && !u.isSystemAdmin,
  user: (u) => !u.isSupplier && !u.isCompanyAdmin && !u.isSystemAdmin,
};

export const USER_ROLES = new Set<string>(Object.keys(ROLE_FILTERS));

// Role is derived from the three booleans, never stored directly — mirrors
// old UserController::deriveRole. Precedence: system_admin > company_admin
// > supplier > user (capabilities are additive on the User model, see the
// Prisma schema comment).
export function deriveRole(user: Pick<User, "isSupplier" | "isCompanyAdmin" | "isSystemAdmin">): UserRole {
  if (user.isSystemAdmin) return "system_admin";
  if (user.isCompanyAdmin) return "company_admin";
  if (user.isSupplier) return "supplier";
  return "user";
}

export function roleWhereClause(role: UserRole) {
  switch (role) {
    case "system_admin":
      return { isSystemAdmin: true };
    case "company_admin":
      return { isCompanyAdmin: true, isSystemAdmin: false };
    case "supplier":
      return { isSupplier: true, isCompanyAdmin: false, isSystemAdmin: false };
    case "user":
      return { isSupplier: false, isCompanyAdmin: false, isSystemAdmin: false };
  }
}

export function serializeAdminUser(user: User & { company: Company | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: deriveRole(user),
    companyId: user.companyId?.toString() ?? null,
    companyName: user.company?.name ?? null,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
