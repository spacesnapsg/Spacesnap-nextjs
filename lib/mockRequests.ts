export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled";
export type BulkOrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled";

export interface BookingRequest {
  id: number;
  requesterName: string;
  listingName: string;
  dateRange: string;
  credits: number;
  status: BookingStatus;
}

export interface BulkOrderRequest {
  id: number;
  requesterName: string;
  listingName: string;
  quantity: string;
  credits: number;
  status: BulkOrderStatus;
}

export const MOCK_BOOKING_REQUESTS: BookingRequest[] = [
  {
    id: 1,
    requesterName: "Sarah Chen",
    listingName: "Wet Lab Bench - Downtown SF",
    dateRange: "Jul 18, 2026",
    credits: 45,
    status: "pending",
  },
  {
    id: 2,
    requesterName: "Marcus Webb",
    listingName: "High-Speed Centrifuge",
    dateRange: "Jul 20 – Jul 27, 2026",
    credits: 150,
    status: "pending",
  },
  {
    id: 3,
    requesterName: "Priya Nair",
    listingName: "PCR Thermocycler",
    dateRange: "Aug 1 – Aug 31, 2026",
    credits: 620,
    status: "confirmed",
  },
  {
    id: 4,
    requesterName: "Tom Baker",
    listingName: "BSL-2 Research Suite",
    dateRange: "Jul 15, 2026",
    credits: 65,
    status: "active",
  },
  {
    id: 5,
    requesterName: "Dana Kim",
    listingName: "BSL-2 Research Suite",
    dateRange: "Jun 24 – Jul 1, 2026",
    credits: 400,
    status: "completed",
  },
  {
    id: 6,
    requesterName: "Alex Rivera",
    listingName: "Wet Lab Bench - Downtown SF",
    dateRange: "May 1 – May 31, 2026",
    credits: 950,
    status: "cancelled",
  },
];

export const MOCK_BULK_ORDER_REQUESTS: BulkOrderRequest[] = [
  {
    id: 1,
    requesterName: "Jordan Lee",
    listingName: "Nitrile Gloves (Case of 100)",
    quantity: "40 cases",
    credits: 320,
    status: "pending",
  },
  {
    id: 2,
    requesterName: "Sofia Ramirez",
    listingName: "Sterile Petri Dishes (Pack of 100)",
    quantity: "200 packs",
    credits: 1000,
    status: "confirmed",
  },
  {
    id: 3,
    requesterName: "Grace Kim",
    listingName: "Sterile Petri Dishes (Pack of 100)",
    quantity: "500 packs",
    credits: 2500,
    status: "fulfilled",
  },
  {
    id: 4,
    requesterName: "Ben Foster",
    listingName: "Nitrile Gloves (Case of 100)",
    quantity: "15 cases",
    credits: 120,
    status: "cancelled",
  },
];
