import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type MarketplaceEnquiryType = "membership" | "consultancy";

export function useSubmitMarketplaceEnquiry() {
  return useMutation({
    mutationFn: (input: { type: MarketplaceEnquiryType; details: string; contactEmail?: string }) =>
      apiFetch("/api/marketplace-enquiries", { method: "POST", body: JSON.stringify(input) }),
  });
}
