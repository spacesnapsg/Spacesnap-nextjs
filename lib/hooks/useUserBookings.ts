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
  sgdAmount: number;
  earnedCreditsApplied: number;
  status: BookingStatus;
  // Modify-Booking fields (Sprint 4.75) — maxRefundablePercent caps a later
  // cancellation's refund (null = never modified, uncapped).
  isModified: boolean;
  originalStartDate: string | null;
  maxRefundablePercent: number | null;
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

// Invalidations shared by cancel/modify: the bookings list (status/dates
// changed), the activity feed (both write an ActivityLog row), and the wallet
// (cancel may reverse an earned-credit discount via earned_grant; modify may
// add a booking_modification_fee row to the transaction feed).
function useBookingMutationInvalidator() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["user-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
  };
}

export function useCancelBooking() {
  const invalidate = useBookingMutationInvalidator();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      apiFetch<{ booking: UserBooking }>(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    onSuccess: invalidate,
  });
}

export function useModifyBooking() {
  const invalidate = useBookingMutationInvalidator();
  return useMutation({
    // paymentMethodId is only required by the server when the reschedule
    // lands in the 3-7-day 20%-fee tier — the modal collects a card exactly
    // then and omits it otherwise.
    mutationFn: ({
      bookingId,
      newStartDate,
      paymentMethodId,
    }: {
      bookingId: string;
      newStartDate: string;
      paymentMethodId?: string;
    }) =>
      apiFetch<{ booking: UserBooking }>(`/api/bookings/${bookingId}/modify`, {
        method: "PATCH",
        body: JSON.stringify({ newStartDate, ...(paymentMethodId ? { paymentMethodId } : {}) }),
      }),
    onSuccess: invalidate,
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
