import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { UserRole, AccountStatus } from "@/lib/hooks/useAdminUsers";

export interface AdminCompanyMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
}

export interface AdminCompany {
  id: string;
  name: string;
  businessName: string | null;
  contactEmail: string | null;
  createdAt: string;
  listingCount: number;
  members: AdminCompanyMember[];
}

export function useAdminCompanies(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["admin-companies", search ?? ""],
    queryFn: () =>
      apiFetch<{ companies: AdminCompany[]; meta: { total: number } }>(`/api/admin/companies${qs}`),
  });
}
