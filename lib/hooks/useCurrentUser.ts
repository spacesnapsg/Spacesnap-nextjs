import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  title: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  memberSince: string;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentUser>("/api/me"),
  });
}
