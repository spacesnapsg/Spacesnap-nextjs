import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface CompanyMember {
  id: string;
  name: string;
  email: string;
  isCompanyAdmin: boolean;
}

export interface CompanyJoinRequest {
  id: string;
  requestedBy: { id: string; name: string; email: string };
  createdAt: string;
}

export function useCompanyMembers() {
  return useQuery({
    queryKey: ["company-members"],
    queryFn: () => apiFetch<{ members: CompanyMember[] }>("/api/supplier/company/members"),
    select: (data) => data.members,
  });
}

function useInvalidateCompanyMembers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["company-members"] });
    queryClient.invalidateQueries({ queryKey: ["company-join-requests"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };
}

export function useRemoveCompanyMember() {
  const invalidate = useInvalidateCompanyMembers();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/supplier/company/members/${userId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function usePromoteCompanyMember() {
  const invalidate = useInvalidateCompanyMembers();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/supplier/company/members/${userId}/promote`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useCompanyJoinRequests() {
  return useQuery({
    queryKey: ["company-join-requests"],
    queryFn: () => apiFetch<{ requests: CompanyJoinRequest[] }>("/api/supplier/company/join-requests"),
    select: (data) => data.requests,
  });
}

export function useResolveCompanyJoinRequest() {
  const invalidate = useInvalidateCompanyMembers();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      apiFetch(`/api/supplier/company/join-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  });
}
