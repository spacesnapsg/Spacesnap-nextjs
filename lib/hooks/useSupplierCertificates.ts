import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Certificate } from "@/lib/hooks/useCertificates";

export function useSubmittedCertificates() {
  return useQuery({
    queryKey: ["supplier-certificates-submitted"],
    queryFn: () => apiFetch<{ certificates: Certificate[] }>("/api/supplier/certificates/submitted"),
    select: (data) => data.certificates,
  });
}

export function useSubmitCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: { name: string; icon?: string | null; category?: string | null }) =>
      apiFetch<{ certificate: Certificate }>("/api/certificates", {
        method: "POST",
        body: JSON.stringify(fields),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-certificates-submitted"] });
    },
  });
}
