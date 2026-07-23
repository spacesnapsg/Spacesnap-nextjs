import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Announcement {
  id: string;
  title: string | null;
  message: string;
  targetMembers: boolean;
  targetSuppliers: boolean;
  createdAt: string;
  isRead: boolean;
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiFetch<{ announcements: Announcement[] }>("/api/announcements"),
    select: (data) => data.announcements,
    // Same cadence as useNotifications — the two feeds are merged in
    // NotificationsPanel and should feel like one live list, not two
    // independently-staled ones.
    refetchInterval: 60_000,
  });
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/announcements/${id}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useMarkAllAnnouncementsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/announcements/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });
}
