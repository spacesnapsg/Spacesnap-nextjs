import type { Company, User } from "@/app/generated/prisma/client";
import { deriveRole, type UserRole } from "@/lib/admin-users";

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

export function serializeAdminCompany(company: Company & { users: User[]; _count: { listings: number } }) {
  return {
    id: company.id.toString(),
    name: company.name,
    businessName: company.businessName,
    contactEmail: company.contactEmail,
    createdAt: company.createdAt.toISOString(),
    listingCount: company._count.listings,
    members: company.users.map(serializeAdminCompanyMember),
  };
}
