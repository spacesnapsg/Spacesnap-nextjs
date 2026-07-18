export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled";
export type BulkOrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled";
export type CertificateRequestStatus = "pending" | "confirmed";

export interface BookingRequest {
  id: number;
  requesterName: string;
  requesterRole: string;
  hasCert: boolean;
  certName: string;
  listingName: string;
  dateRange: string;
  credits: number;
  status: BookingStatus;
}

export interface BulkOrderRequest {
  id: number;
  requesterName: string;
  email: string;
  company: string;
  listingName: string;
  quantity: string;
  deliveryDate: string;
  useCase: string;
  credits: number;
  status: BulkOrderStatus;
}

export interface CertificateRequest {
  id: number;
  name: string;
  context: string;
  status: CertificateRequestStatus;
}

export const MOCK_BOOKING_REQUESTS: BookingRequest[] = [
  {
    id: 1,
    requesterName: "Sarah Chen",
    requesterRole: "Research Scientist",
    hasCert: true,
    certName: "BSL-2 Safety",
    listingName: "Wet Lab Bench - Downtown SF",
    dateRange: "Jul 18, 2026",
    credits: 45,
    status: "pending",
  },
  {
    id: 2,
    requesterName: "Marcus Webb",
    requesterRole: "Lab Technician",
    hasCert: false,
    certName: "Equipment Handling",
    listingName: "High-Speed Centrifuge",
    dateRange: "Jul 20 – Jul 27, 2026",
    credits: 150,
    status: "pending",
  },
  {
    id: 3,
    requesterName: "Priya Nair",
    requesterRole: "Principal Investigator",
    hasCert: true,
    certName: "Equipment Handling",
    listingName: "PCR Thermocycler",
    dateRange: "Aug 1 – Aug 31, 2026",
    credits: 620,
    status: "confirmed",
  },
  {
    id: 4,
    requesterName: "Tom Baker",
    requesterRole: "Graduate Student",
    hasCert: false,
    certName: "Chemical Handling",
    listingName: "BSL-2 Research Suite",
    dateRange: "Jul 15, 2026",
    credits: 65,
    status: "active",
  },
  {
    id: 5,
    requesterName: "Dana Kim",
    requesterRole: "Postdoc Researcher",
    hasCert: true,
    certName: "Chemical Handling",
    listingName: "BSL-2 Research Suite",
    dateRange: "Jun 24 – Jul 1, 2026",
    credits: 400,
    status: "completed",
  },
  {
    id: 6,
    requesterName: "Alex Rivera",
    requesterRole: "Research Associate",
    hasCert: false,
    certName: "BSL-2 Safety",
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
    email: "jordan.lee@biotech.io",
    company: "NovaBio Therapeutics",
    listingName: "Nitrile Gloves (Case of 100)",
    quantity: "40 cases",
    deliveryDate: "Aug 10, 2026",
    useCase:
      "We are scaling up our wet lab operations ahead of a new research grant and need a reliable bulk supply of nitrile gloves for three lab teams. Consistent stock and delivery timing are critical since our current supplier has been inconsistent.",
    credits: 320,
    status: "pending",
  },
  {
    id: 2,
    requesterName: "Sofia Ramirez",
    email: "sofia.ramirez@gene-labs.com",
    company: "GeneLabs Inc.",
    listingName: "Sterile Petri Dishes (Pack of 100)",
    quantity: "200 packs",
    deliveryDate: "Jul 25, 2026",
    useCase:
      "Our cell culture core facility runs high-throughput plating experiments weekly and we are standardizing on a single sterile petri dish vendor across all our satellite labs to simplify procurement and quality control.",
    credits: 1000,
    status: "confirmed",
  },
  {
    id: 3,
    requesterName: "Grace Kim",
    email: "grace.kim@cellworks.bio",
    company: "CellWorks Bio",
    listingName: "Sterile Petri Dishes (Pack of 100)",
    quantity: "500 packs",
    deliveryDate: "Sep 1, 2026",
    useCase:
      "Preparing for a major expansion of our tissue culture lab with two new hires starting next quarter. This order covers our projected consumable needs through the end of the year.",
    credits: 2500,
    status: "fulfilled",
  },
  {
    id: 4,
    requesterName: "Ben Foster",
    email: "ben.foster@gmail.com",
    company: "",
    listingName: "Nitrile Gloves (Case of 100)",
    quantity: "15 cases",
    deliveryDate: "Aug 3, 2026",
    useCase:
      "Independent consultant working with a handful of small biotech clients on short-term projects. Need a modest bulk order to keep on hand for on-site visits without committing to a long-term supply contract.",
    credits: 120,
    status: "cancelled",
  },
];

export const MOCK_CERTIFICATE_REQUESTS: CertificateRequest[] = [
  {
    id: 1,
    name: "Biosafety Level 3 (BSL-3)",
    context:
      "We are expanding into aerosol-transmissible pathogen research and need staff certified to BSL-3 standards before onboarding two client bookings scheduled for next quarter.",
    status: "pending",
  },
  {
    id: 2,
    name: "Radiation Safety Officer",
    context:
      "Several suppliers on the marketplace list radioisotope handling as a listing requirement. Adding this certificate to the pool would let us support those bookings without manual workarounds.",
    status: "confirmed",
  },
];
