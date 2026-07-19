import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api-client";

export interface Credential {
  id: string;
  certificateId: string;
  earnedDate: string;
  expiryDate: string | null;
  certificate: {
    id: string;
    name: string;
    icon: string | null;
    category: string | null;
    source: string;
    status: string;
  };
}

export function useCredentials() {
  const { status } = useSession();

  return useQuery({
    queryKey: ["credentials"],
    queryFn: () => apiFetch<{ credentials: Credential[] }>("/api/credentials"),
    select: (data) => data.credentials,
    enabled: status === "authenticated",
  });
}

export function isCredentialHeld(credentials: Credential[] | undefined, certificateId: string): boolean {
  if (!credentials) return false;
  const today = new Date().toISOString().slice(0, 10);
  return credentials.some(
    (c) => c.certificateId === certificateId && (c.expiryDate === null || c.expiryDate >= today)
  );
}
