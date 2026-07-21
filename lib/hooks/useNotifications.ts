import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Notification {
  id: string;
  title: string | null;
  message: string;
  type: string | null;
  pinned: boolean;
  isRead: boolean;
  relatedBookingId: string | null;
  relatedListingId: string | null;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ notifications: Notification[] }>("/api/notifications"),
    select: (data) => data.notifications,
    // Cheap polling so the pinned booking-credit-pending entry disappears
    // promptly once resolved from elsewhere (e.g. the rebook modal), without
    // needing a shared invalidation wire-up across every mutation that could
    // touch it.
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
