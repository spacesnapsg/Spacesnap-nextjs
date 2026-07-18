export interface SupplierProfile {
  name: string;
  title: string;
  avatarUrl: string | null;
  email: string;
  location: string;
  memberSince: string;
}

export const MOCK_SUPPLIER_PROFILE: SupplierProfile = {
  name: "Marina Costa",
  title: "Lab Space Supplier",
  avatarUrl: null,
  email: "marina.costa@labspaces.io",
  location: "San Francisco, CA",
  memberSince: "Mar 2024",
};

// Whether the current supplier is already their company's admin. Company
// admins see the Company Admin Details card and skip the promotion flow;
// everyone else sees the Request Promotion button. Mirrors the future
// `company.admin_id` check from the API — flip to swap in the real field
// once /supplier/profile and /supplier/promote-admin are wired up.
export const MOCK_IS_COMPANY_ADMIN = false;

export interface BusinessDetails {
  businessName: string;
  businessRegistrationNumber: string;
  financeContactEmail: string;
  businessLocation: string;
  financeContactPersonName: string;
}

export const MOCK_BUSINESS_DETAILS: BusinessDetails = {
  businessName: "Costa Lab Spaces",
  businessRegistrationNumber: "12-3455678",
  financeContactEmail: "finance@labspaces.io",
  businessLocation: "250 Mission St, San Francisco, CA",
  financeContactPersonName: "David Chen",
};

export interface CompanyAdminDetails {
  companyRegistrationNumber: string;
  phone: string;
  financePocName: string;
  financePocEmail: string;
}

export const MOCK_COMPANY_ADMIN_DETAILS: CompanyAdminDetails = {
  companyRegistrationNumber: "12-3455678",
  phone: "(415) 555-0182",
  financePocName: "David Chen",
  financePocEmail: "finance@labspaces.io",
};

export interface ListingStat {
  label: string;
  value: string;
}

export const MOCK_LISTING_STATS: ListingStat[] = [
  { label: "Total Listings", value: "12" },
  { label: "Total Completed Bookings", value: "284" },
  { label: "Average Rating", value: "4.8 / 5" },
  { label: "Member Since", value: MOCK_SUPPLIER_PROFILE.memberSince },
];

export const MOCK_RECEIVABLE_SUMMARY = {
  totalReceivable: 4820,
  overdueAmount: 650,
  overdueCount: 2,
};

export type InvoiceStatus = "Paid" | "Pending";

export interface Invoice {
  id: string;
  payer: string;
  listing: string;
  credits: number;
  dueDate: string;
  status: InvoiceStatus;
}

export const MOCK_INVOICES: Invoice[] = [
  {
    id: "INV-1042",
    payer: "Sarah Chen",
    listing: "Wet Lab Bench - Downtown SF",
    credits: 450,
    dueDate: "Jul 20, 2026",
    status: "Paid",
  },
  {
    id: "INV-1051",
    payer: "Marcus Webb",
    listing: "High-Speed Centrifuge",
    credits: 150,
    dueDate: "Jul 10, 2026",
    status: "Pending",
  },
  {
    id: "INV-1058",
    payer: "Priya Nair",
    listing: "PCR Thermocycler",
    credits: 620,
    dueDate: "Jun 30, 2026",
    status: "Pending",
  },
];

export interface Receipt {
  id: string;
  description: string;
  date: string;
  credits: number;
}

export const MOCK_RECEIPTS: Receipt[] = [
  {
    id: "RCP-2201",
    description: "Monthly payout - June 2026",
    date: "Jul 1, 2026",
    credits: 1240,
  },
  {
    id: "RCP-2188",
    description: "Monthly payout - May 2026",
    date: "Jun 1, 2026",
    credits: 980,
  },
  {
    id: "INV-1042",
    description: "Booking invoice - Wet Lab Bench",
    date: "Jul 20, 2026",
    credits: 450,
  },
];
