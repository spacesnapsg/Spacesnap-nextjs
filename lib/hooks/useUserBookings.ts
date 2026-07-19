import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BookingStatus, BookingType } from "@/lib/hooks/useSupplierBookings";

export interface UserBooking {
  id: string;
  listingId: string;
  listingName?: string;
  listingType?: "space" | "equipment" | "consumables";
  bookingType: BookingType;
  startDate: string;
  endDate: string;
  credits: number;
  status: BookingStatus;
  rating: { id: string; score: number; comment: string | null } | null;
}

export function useUserBookings(status?: BookingStatus | "all") {
  const qs = status && status !== "all" ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["user-bookings", status ?? "all"],
    queryFn: () => apiFetch<{ bookings: UserBooking[] }>(`/api/bookings${qs}`),
    select: (data) => data.bookings,
  });
}

export function useSubmitRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, score, comment }: { bookingId: string; score: number; comment?: string | null }) =>
      apiFetch(`/api/bookings/${bookingId}/rating`, {
        method: "POST",
        body: JSON.stringify({ score, comment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
