import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface PendingResolutionBooking {
  id: string;
  listingId: string;
  listingName?: string;
  listingType?: "space" | "equipment" | "consumables";
  startDate: string;
  endDate: string;
  sgdAmount: number;
  credit: { id: string; amount: number; expiresAt: string } | null;
}

// Powers the "your booking was cancelled" login modal and the pinned
// notification — see app/api/bookings/pending-resolution/route.ts.
export function usePendingResolutionBookings() {
  return useQuery({
    queryKey: ["bookings", "pending-resolution"],
    queryFn: () => apiFetch<{ bookings: PendingResolutionBooking[] }>("/api/bookings/pending-resolution"),
    select: (data) => data.bookings,
  });
}

// The last card in the rebook-alternatives scroll — "refund me instead."
export function useClaimBookingCreditRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => apiFetch(`/api/bookings/${bookingId}/claim-refund`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings", "pending-resolution"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
