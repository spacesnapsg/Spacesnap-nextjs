import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type BoostProductBuiltinEffect = "bump" | "pin" | "none";
export type BoostProductIconName = "zap" | "pin" | "file-text" | "megaphone" | "mail" | "star" | "tag";

export interface BoostProduct {
  id: string;
  builtinEffect: BoostProductBuiltinEffect;
  name: string;
  description: string;
  iconName: BoostProductIconName;
  active: boolean;
  sortOrder: number;
  priceCredits: number | null;
  pin7PriceCredits: number | null;
  pin30PriceCredits: number | null;
}

export interface BoostProductCreateInput {
  name: string;
  description: string;
  iconName: BoostProductIconName;
  priceCredits: number;
  active?: boolean;
}

export interface BoostProductUpdateInput {
  name?: string;
  description?: string;
  iconName?: BoostProductIconName;
  active?: boolean;
  priceCredits?: number;
  pin7PriceCredits?: number;
  pin30PriceCredits?: number;
}

// Supplier-facing read — powers ListingBoostCatalogueCard. Active rows only;
// however many exist is however many cards render.
export function useSupplierBoostProducts() {
  return useQuery({
    queryKey: ["supplier-boost-products"],
    queryFn: () => apiFetch<{ boostProducts: BoostProduct[] }>("/api/supplier/boost-products"),
    select: (data) => data.boostProducts,
  });
}

// Direct purchase of a builtinEffect "none" product (permission-gated at the
// route layer, same as usePurchaseBumps/usePurchasePin) — a non-permitted
// member should use useCreateCompanyBoostRequest instead.
export function usePurchaseBoostProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      apiFetch<{ boostProductId: string; quantity: number }>(`/api/supplier/company/boost-products/${id}/purchase`, {
        method: "POST",
        body: JSON.stringify({ quantity }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-company"] }),
  });
}

// Admin CRUD — powers the /admin-boost-products page.
export function useAdminBoostProducts() {
  return useQuery({
    queryKey: ["admin-boost-products"],
    queryFn: () => apiFetch<{ boostProducts: BoostProduct[] }>("/api/admin/boost-products"),
    select: (data) => data.boostProducts,
  });
}

export function useAdminCreateBoostProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BoostProductCreateInput) =>
      apiFetch<{ boostProduct: BoostProduct }>("/api/admin/boost-products", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-boost-products"] }),
  });
}

export function useAdminUpdateBoostProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: BoostProductUpdateInput & { id: string }) =>
      apiFetch<{ boostProduct: BoostProduct }>(`/api/admin/boost-products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-boost-products"] }),
  });
}

export function useAdminDeleteBoostProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/boost-products/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-boost-products"] }),
  });
}
