import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type BannerPortal = "member" | "supplier";

export interface Banner {
  id: string;
  portal: BannerPortal;
  imageUrl: string;
  expiresAt: string | null;
  updatedAt: string;
}

// null means "no banner configured, or it expired" — enforced server-side
// (getActiveBanner, lib/banners.ts), the client never has to special-case
// expiry itself.
export function useBanner(portal: BannerPortal) {
  return useQuery({
    queryKey: ["banner", portal],
    queryFn: () => apiFetch<{ banner: Banner | null }>(`/api/banners/${portal}`),
    select: (data) => data.banner,
  });
}
