import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type CertificateStatus = "pending" | "approved" | "rejected";

export interface AdminCertificate {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
  earningMethod: string;
  submissionNotes: string | null;
  source: string;
  status: CertificateStatus;
  createdByCompanyId: string | null;
  createdByCompanyName?: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface AdminCertificatesFilters {
  status?: CertificateStatus;
  search?: string;
}

export function useAdminCertificates(filters: AdminCertificatesFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ["admin-certificates", filters],
    queryFn: () =>
      apiFetch<{ certificates: AdminCertificate[]; meta: { page: number; perPage: number; total: number } }>(
        `/api/admin/certificates${qs ? `?${qs}` : ""}`
      ),
  });
}

export function usePendingCertificates() {
  return useQuery({
    queryKey: ["admin-certificates-pending"],
    queryFn: () => apiFetch<{ certificates: AdminCertificate[] }>("/api/admin/certificates/pending"),
    select: (data) => data.certificates,
  });
}

function useInvalidateAdminCertificates() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin-certificates"] });
    queryClient.invalidateQueries({ queryKey: ["admin-certificates-pending"] });
  };
}

export function useApproveCertificate() {
  const invalidate = useInvalidateAdminCertificates();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ certificate: AdminCertificate }>(`/api/admin/certificates/${id}/approve`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useRejectCertificate() {
  const invalidate = useInvalidateAdminCertificates();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ certificate: AdminCertificate }>(`/api/admin/certificates/${id}/reject`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useAdminCreateCertificate() {
  const invalidate = useInvalidateAdminCertificates();
  return useMutation({
    mutationFn: (fields: { name: string; category?: string | null; submissionNotes?: string | null }) =>
      apiFetch<{ certificate: AdminCertificate }>("/api/admin/certificates", {
        method: "POST",
        body: JSON.stringify(fields),
      }),
    onSuccess: invalidate,
  });
}
