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
  // Only populated by GET /api/certificates (the public catalog) — see that
  // route's requiredForListings join. Other callers of serializeCertificate
  // (admin certs list, etc.) leave this undefined.
  requiredForListingNames?: string[];
}

export function useCertificateCatalog() {
  return useQuery({
    queryKey: ["certificates"],
    queryFn: () => apiFetch<{ certificates: Certificate[] }>("/api/certificates"),
    select: (data) => data.certificates,
  });
}
