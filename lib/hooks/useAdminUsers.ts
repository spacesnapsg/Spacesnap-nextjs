import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type UserRole = "system_admin" | "company_admin" | "supplier" | "user";
export type AccountStatus = "active" | "suspended";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
  status: AccountStatus;
  createdAt: string;
}

interface AdminUsersFilters {
  role?: UserRole;
  search?: string;
}

export function useAdminUsers(filters: AdminUsersFilters = {}) {
  const params = new URLSearchParams();
  if (filters.role) params.set("role", filters.role);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ["admin-users", filters],
    queryFn: () =>
      apiFetch<{ users: AdminUser[]; meta: { page: number; perPage: number; total: number } }>(
        `/api/admin/users${qs ? `?${qs}` : ""}`
      ),
  });
}

function useInvalidateAdminUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });
}

export function useSuspendUser() {
  const invalidate = useInvalidateAdminUsers();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ user: AdminUser }>(`/api/admin/users/${id}/suspend`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useReinstateUser() {
  const invalidate = useInvalidateAdminUsers();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ user: AdminUser }>(`/api/admin/users/${id}/reinstate`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}
