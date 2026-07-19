import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type ListingType = "space" | "equipment" | "consumables";

export interface Listing {
  id: string;
  companyId: string;
  companyName?: string;
  averageRating: number | null;
  ratingCount: number;
  type: ListingType;
  name: string;
  location: string | null;
  description: string | null;
  imageUrl: string | null;
  amenities: string[];
  isAvailable: boolean;
  requireApproval: boolean;
  priceDay: number | null;
  priceWeek: number | null;
  priceMonth: number | null;
  pricePerUnit: number | null;
  stockQuantity: number | null;
  packSize: string | null;
  requiredCertificateIds?: string[];
  requiredCertificates?: { id: string; name: string; category: string | null }[];
  createdAt: string;
  updatedAt: string;
}

interface ListingsFilters {
  type?: ListingType;
  location?: string;
  search?: string;
}

export function useListings(filters: ListingsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.location) params.set("location", filters.location);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ["listings", filters],
    queryFn: () => apiFetch<{ listings: Listing[] }>(`/api/listings${qs ? `?${qs}` : ""}`),
    select: (data) => data.listings,
  });
}

export type BookingType = "daily" | "weekly" | "monthly";

interface CreateBookingInput {
  listingId: string;
  bookingType: BookingType;
  startDate: string;
  endDate: string;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) =>
      apiFetch("/api/bookings", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

interface CreateBulkOrderInput {
  listingId: string;
  quantity: number;
}

export function useCreateBulkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBulkOrderInput) =>
      apiFetch("/api/bulk-order-requests", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
