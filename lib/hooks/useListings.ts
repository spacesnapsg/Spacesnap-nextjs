import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type ListingType = "space" | "equipment" | "consumables";

export interface Listing {
  id: string;
  companyId: string;
  companyName?: string;
  ownerId: string | null;
  ownerName?: string | null;
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
  // Session: feat/internal-training-signoff. Opt-in, default off — when on,
  // a member holding a credential earned via a buyer-org admin's internal
  // sign-off (not just operator/SME) also satisfies this listing's
  // requiredCertificates gate.
  acceptsInternalSignoff: boolean;
  priceDay: number | null;
  priceWeek: number | null;
  priceMonth: number | null;
  pricePerUnit: number | null;
  stockQuantity: number | null;
  packSize: string | null;
  // Sprint 6.12 — computed server-side (serializeListing, lib/listings.ts):
  // true only while pinnedUntil is set and still in the future.
  isPinned: boolean;
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
  // Absent when fundingSource is "organization" — that path never charges
  // Stripe (see createBookingWithDebit's own buyerOrganizationId param,
  // lib/bookings.ts).
  paymentMethodId?: string;
  rewardGrantId?: string;
  bookingCreditId?: string;
  fundingSource?: "personal" | "organization";
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) =>
      apiFetch("/api/bookings", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      // A bookingCreditId redemption resolves the source booking too — keep
      // the pending-resolution modal/notification in sync without a reload.
      queryClient.invalidateQueries({ queryKey: ["bookings", "pending-resolution"] });
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

interface CreatePurchaseInput {
  listingId: string;
  quantity: number;
  fundingSource?: "personal" | "organization";
}

// "Buy Now" — POST /api/purchases, an immediate completed sale (stock +
// credits move at creation). Deliberately a separate endpoint/hook from
// useCreateBulkOrder above, not the same mutation with a flag — bulk orders
// stay pending for the supplier to act on, this doesn't.
export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseInput) =>
      apiFetch("/api/purchases", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
