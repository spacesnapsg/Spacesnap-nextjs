import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type AdminNotificationType =
  | "new_user"
  | "new_supplier"
  | "new_booking"
  | "new_credential"
  | "new_listing"
  | "new_purchase"
  | "wallet_topup"
  | "refund";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  isArchived: boolean;
  relatedUserId: string | null;
  relatedCompanyId: string | null;
  relatedBookingId: string | null;
  relatedCertificateId: string | null;
  createdAt: string;
}

interface AdminNotificationsResponse {
  notifications: AdminNotification[];
  meta: { page: number; perPage: number; total: number };
}

export function useAdminNotifications(status: "active" | "archived", page: number) {
  return useQuery({
    queryKey: ["admin-notifications", status, page],
    queryFn: () => apiFetch<AdminNotificationsResponse>(`/api/admin/notifications?status=${status}&page=${page}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminNotificationsUnreadCount() {
  return useQuery({
    queryKey: ["admin-notifications-unread-count"],
    queryFn: () => apiFetch<{ count: number }>("/api/admin/notifications/unread-count"),
    // Polled so the badge stays roughly current without the admin needing to
    // reload — cheap COUNT query, matches this app's other lightweight polls.
    refetchInterval: 60000,
  });
}

function useInvalidateAdminNotifications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    qc.invalidateQueries({ queryKey: ["admin-notifications-unread-count"] });
  };
}

export function useSetAdminNotificationRead() {
  const invalidate = useInvalidateAdminNotifications();
  return useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      apiFetch<{ success: true }>(`/api/admin/notifications/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ isRead }),
      }),
    onSuccess: invalidate,
  });
}

export function useSetAdminNotificationArchived() {
  const invalidate = useInvalidateAdminNotifications();
  return useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      apiFetch<{ success: true }>(`/api/admin/notifications/${id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived }),
      }),
    onSuccess: invalidate,
  });
}

export function useMarkAllAdminNotificationsRead() {
  const invalidate = useInvalidateAdminNotifications();
  return useMutation({
    mutationFn: () => apiFetch<{ success: true }>("/api/admin/notifications/mark-all-read", { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useArchiveAllAdminNotifications() {
  const invalidate = useInvalidateAdminNotifications();
  return useMutation({
    mutationFn: () => apiFetch<{ success: true }>("/api/admin/notifications/archive-all", { method: "PATCH" }),
    onSuccess: invalidate,
  });
}
