import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled" | "declined_pending_resolution";
export type BookingType = "daily" | "weekly" | "monthly";

export interface SupplierBooking {
  id: string;
  userId: string;
  listingId: string;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
  sgdAmount: number;
  earnedCreditsApplied: number;
  status: BookingStatus;
  listingName?: string;
  requiredCertificates?: { certificateId: string; certificateName: string }[];
  userName?: string;
  userEmail?: string;
  userTitle?: string | null;
  createdAt: string;
}

export function useSupplierBookings(status?: BookingStatus | "all") {
  const qs = status && status !== "all" ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["supplier-bookings", status ?? "all"],
    queryFn: () => apiFetch<{ bookings: SupplierBooking[] }>(`/api/supplier/bookings${qs}`),
    select: (data) => data.bookings,
  });
}

export interface SupplierBookingsFeedResult {
  bookings: SupplierBooking[];
  meta: { page: number; pageSize: number; total: number };
}

// Paginated + date-range-filterable feed, distinct from useSupplierBookings'
// full unpaginated list above — backs the Analytics page's "Recent Bookings"
// table (Sprint 6.10, 2026-07-23). Mirrors useActivity's (lib/hooks/useActivity.ts)
// query-building shape.
export function useSupplierBookingsFeed(dateRange: { from: string | null; to: string | null }, page: number) {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  params.set("page", String(page));

  return useQuery({
    queryKey: ["supplier-bookings-feed", dateRange, page],
    queryFn: () => apiFetch<SupplierBookingsFeedResult>(`/api/supplier/bookings/recent?${params.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}

function useInvalidateSupplierBookings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["supplier-bookings"] });
}

export function useConfirmBooking() {
  const invalidate = useInvalidateSupplierBookings();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ booking: SupplierBooking }>(`/api/supplier/bookings/${id}/confirm`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useDeclineBooking() {
  const invalidate = useInvalidateSupplierBookings();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ booking: SupplierBooking }>(`/api/supplier/bookings/${id}/decline`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}
