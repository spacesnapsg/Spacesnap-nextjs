import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BannerPortal, Banner } from "@/lib/hooks/useBanner";

export function useAdminBanner(portal: BannerPortal) {
  return useQuery({
    queryKey: ["admin-banner", portal],
    queryFn: () => apiFetch<{ banner: Banner | null }>(`/api/admin/banners/${portal}`),
    select: (data) => data.banner,
  });
}

export function useAdminSetBanner(portal: BannerPortal) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { imageKey: string; expiresAt: string | null }) =>
      apiFetch<{ banner: Banner }>(`/api/admin/banners/${portal}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banner", portal] });
      queryClient.invalidateQueries({ queryKey: ["banner", portal] });
    },
  });
}
