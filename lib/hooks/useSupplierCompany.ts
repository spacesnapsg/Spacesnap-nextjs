import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface CompanyDetails {
  id: string;
  name: string;
  businessName: string | null;
  businessDescription: string | null;
  registrationNumber: string | null;
  financeContactEmail: string | null;
  financeContactPerson: string | null;
}

export interface BusinessDetailsFields {
  businessName?: string | null;
  businessDescription?: string | null;
  registrationNumber?: string | null;
  financeContactEmail?: string | null;
  financeContactPerson?: string | null;
}

export function useSupplierCompany() {
  return useQuery({
    queryKey: ["supplier-company"],
    queryFn: () => apiFetch<{ company: CompanyDetails }>("/api/supplier/company"),
    select: (data) => data.company,
  });
}

export function useUpdateSupplierCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: BusinessDetailsFields) =>
      apiFetch<{ company: CompanyDetails }>("/api/supplier/company", {
        method: "PATCH",
        body: JSON.stringify(fields),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-company"] }),
  });
}
