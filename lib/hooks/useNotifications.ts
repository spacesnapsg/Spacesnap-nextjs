import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Notification {
  id: string;
  title: string | null;
  message: string;
  type: string | null;
  pinned: boolean;
  isRead: boolean;
  isArchived: boolean;
  relatedBookingId: string | null;
  relatedListingId: string | null;
  createdAt: string;
}

interface NotificationsPageResponse {
  notifications: Notification[];
  meta: { page: number; perPage: number; total: number };
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

// Backs the full /notifications (and /supplier-notifications) page —
// Active/Archived toggle + 10/page pagination, same shape as
// useAdminNotifications.
export function useNotificationsPage(status: "active" | "archived", page: number) {
  return useQuery({
    queryKey: ["notifications", status, page],
    queryFn: () => apiFetch<NotificationsPageResponse>(`/api/notifications?status=${status}&page=${page}`),
    placeholderData: keepPreviousData,
  });
}

// Invalidating the ["notifications"] prefix catches both the dropdown query
// (key ["notifications"]) and every paginated page query (key
// ["notifications", status, page]) in one call.
function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => apiFetch("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useArchiveNotification() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      apiFetch<{ success: true }>(`/api/notifications/${id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived }),
      }),
    onSuccess: invalidate,
  });
}
