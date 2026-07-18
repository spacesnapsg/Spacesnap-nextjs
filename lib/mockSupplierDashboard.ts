export type SupplierBookingStatus = "confirmed" | "active" | "pending" | "cancelled";
export type SupplierBookingType = "daily" | "weekly" | "monthly";

export interface SupplierStat {
  label: string;
  value: string;
}

export const MOCK_SUPPLIER_STATS: SupplierStat[] = [
  { label: "Total Revenue", value: "12,480 cr" },
  { label: "Active Bookings", value: "18" },
  { label: "Total Listings", value: "32" },
  { label: "Avg. Rating", value: "4.8" },
];

export const MOCK_REVENUE_BARS: number[] = [40, 65, 50, 80, 60, 90, 75];

export interface SupplierRecentBooking {
  id: number;
  user: string;
  listing: string;
  type: SupplierBookingType;
  credits: number;
  status: SupplierBookingStatus;
  date: string;
}

export const MOCK_SUPPLIER_RECENT_BOOKINGS: SupplierRecentBooking[] = [
  {
    id: 1,
    user: "Maria Chen",
    listing: "Wet Lab Bench - Downtown SF",
    type: "weekly",
    credits: 280,
    status: "confirmed",
    date: "2026-07-14",
  },
  {
    id: 2,
    user: "James Okafor",
    listing: "High-Speed Centrifuge",
    type: "daily",
    credits: 25,
    status: "active",
    date: "2026-07-13",
  },
  {
    id: 3,
    user: "Priya Nair",
    listing: "BSL-2 Research Suite",
    type: "monthly",
    credits: 1400,
    status: "pending",
    date: "2026-07-12",
  },
  {
    id: 4,
    user: "Tom Alvarez",
    listing: "PCR Thermocycler",
    type: "daily",
    credits: 30,
    status: "cancelled",
    date: "2026-07-10",
  },
  {
    id: 5,
    user: "Sara Lindqvist",
    listing: "Nitrile Gloves (Case of 100)",
    type: "weekly",
    credits: 45,
    status: "confirmed",
    date: "2026-07-09",
  },
];
