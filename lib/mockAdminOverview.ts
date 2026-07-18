export interface AdminStat {
  label: string;
  value: string;
}

export const MOCK_ADMIN_STATS: AdminStat[] = [
  { label: "Total Users", value: "1,284" },
  { label: "Total Companies", value: "96" },
  { label: "Total Bookings", value: "3,412" },
  { label: "Platform Revenue", value: "184,920 cr" },
];

export const MOCK_PENDING_BOOKINGS = 12;
export const MOCK_PROMOTION_REQUESTS = 3;

export type CertificateSource = "platform" | "supplier_created";

export interface PendingCertificate {
  id: number;
  name: string;
  category: string;
  source: CertificateSource;
  context: string;
}

export const MOCK_PENDING_CERTIFICATES: PendingCertificate[] = [
  {
    id: 1,
    name: "Laser Cutter Safety",
    category: "Equipment",
    source: "supplier_created",
    context:
      "Required before we can list our new CO2 laser cutter — two bookings are already on hold pending this certificate.",
  },
  {
    id: 2,
    name: "Biosafety Level 2",
    category: "Safety",
    source: "supplier_created",
    context:
      "Standardizing our wet lab access requirements across all listings; several suppliers already require this for equivalent equipment.",
  },
  {
    id: 3,
    name: "Cleanroom Protocol",
    category: "House Rules",
    source: "supplier_created",
    context:
      "Our cleanroom space has strict gowning and contamination-control procedures that aren't covered by any existing certificate in the pool.",
  },
];
