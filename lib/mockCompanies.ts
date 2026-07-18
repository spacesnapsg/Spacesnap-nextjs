export interface Company {
  id: number;
  name: string;
}

export const MOCK_COMPANIES: Company[] = [
  { id: 1, name: "Costa Lab Spaces" },
  { id: 2, name: "Austin Labs Co." },
  { id: 3, name: "Cambridge BioWorks" },
];

export function getCompanyName(companyId: number) {
  return MOCK_COMPANIES.find((company) => company.id === companyId)?.name ?? "Unknown Supplier";
}
