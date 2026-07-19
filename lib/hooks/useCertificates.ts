import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Certificate {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
  earningMethod: string;
  status: string;
  createdAt: string;
}

export function useCertificateCatalog() {
  return useQuery({
    queryKey: ["certificates"],
    queryFn: () => apiFetch<{ certificates: Certificate[] }>("/api/certificates"),
    select: (data) => data.certificates,
  });
}
