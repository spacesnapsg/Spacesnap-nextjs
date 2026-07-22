import type { Company, User } from "@/app/generated/prisma/client";
import { deriveRole, type UserRole } from "@/lib/admin-users";
import type { SupplierTier } from "@/lib/supplier-tiers";

export function serializeAdminCompanyMember(
  user: Pick<User, "id" | "name" | "email" | "status" | "isSupplier" | "isCompanyAdmin" | "isSystemAdmin">
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: deriveRole(user) as UserRole,
    status: user.status,
  };
}

// supplierTier is passed in precomputed (Sprint 6.10, lib/supplier-tiers.ts)
// rather than read off the company row — it's live-computed from rating +
// rolling-window spend, never a stored column, and computing it requires its
// own DB aggregate queries this synchronous serializer can't make itself.
export function serializeAdminCompany(
  company: Company & { users: User[]; _count: { listings: number } },
  supplierTier: SupplierTier
) {
  return {
    id: company.id.toString(),
    name: company.name,
    businessName: company.businessName,
    contactEmail: company.contactEmail,
    createdAt: company.createdAt.toISOString(),
    listingCount: company._count.listings,
    supplierTier,
    members: company.users.map(serializeAdminCompanyMember),
  };
}
