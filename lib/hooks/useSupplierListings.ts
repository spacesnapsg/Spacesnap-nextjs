import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Listing, ListingType } from "@/lib/hooks/useListings";

// Client-safe mirror of lib/listings.ts's PIN_DURATION_COST_CREDITS — same
// reasoning as BUMP_UNIT_COST_CREDITS_DISPLAY (lib/hooks/useSupplierCompany.ts).
export const PIN_DURATION_COST_CREDITS_DISPLAY: Record<7 | 30, number> = { 7: 200, 30: 600 };

export function useSupplierListings() {
  return useQuery({
    queryKey: ["supplier-listings"],
    queryFn: () => apiFetch<{ listings: Listing[] }>("/api/supplier/listings"),
    select: (data) => data.listings,
  });
}

export interface ListingFormFields {
  name: string;
  type: ListingType;
  location: string | null;
  description: string | null;
  amenities: string[];
  isAvailable: boolean;
  requireApproval: boolean;
  priceDay?: number | null;
  priceWeek?: number | null;
  priceMonth?: number | null;
  pricePerUnit?: number | null;
  stockQuantity?: number | null;
  packSize?: string | null;
  requiredCertificateIds: string[];
}

function useInvalidateSupplierListings() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["supplier-listings"] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
  };
}

export function useCreateListing() {
  const invalidate = useInvalidateSupplierListings();
  return useMutation({
    mutationFn: (fields: ListingFormFields) =>
      apiFetch<{ listing: Listing }>("/api/supplier/listings", {
        method: "POST",
        body: JSON.stringify(fields),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateListing() {
  const invalidate = useInvalidateSupplierListings();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<ListingFormFields> }) =>
      apiFetch<{ listing: Listing }>(`/api/supplier/listings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      }),
    onSuccess: invalidate,
  });
}

export function useToggleAvailability() {
  const invalidate = useInvalidateSupplierListings();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ listing: Listing }>(`/api/supplier/listings/${id}/availability`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}
