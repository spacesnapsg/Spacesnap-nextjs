import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface AdminAnnouncement {
  id: string;
  title: string | null;
  message: string;
  targetMembers: boolean;
  targetSuppliers: boolean;
  createdAt: string;
}

export interface AnnouncementInput {
  title?: string | null;
  message: string;
  targetMembers: boolean;
  targetSuppliers: boolean;
}

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => apiFetch<{ announcements: AdminAnnouncement[] }>("/api/admin/announcements"),
    select: (data) => data.announcements,
  });
}

export function useAdminSendAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) =>
      apiFetch<{ announcement: AdminAnnouncement }>("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });
}
