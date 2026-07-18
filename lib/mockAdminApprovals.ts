export interface PendingBooking {
  id: number;
  user: string;
  listing: string;
  company: string;
  bookingType: "daily" | "weekly" | "monthly";
  dateRange: string;
  credits: number;
  submittedDate: string;
}

// TODO: replace with GET /api/admin/bookings/pending once the backend admin panel exists.
export const MOCK_PENDING_BOOKINGS: PendingBooking[] = [
  {
    id: 1,
    user: "Sarah Chen",
    listing: "Wet Lab Bench 4",
    company: "NovaBio Therapeutics",
    bookingType: "weekly",
    dateRange: "Aug 4 – Aug 10, 2026",
    credits: 420,
    submittedDate: "2026-07-15",
  },
  {
    id: 2,
    user: "Ben Foster",
    listing: "CO2 Laser Cutter",
    company: "GeneLabs Inc.",
    bookingType: "daily",
    dateRange: "Jul 22, 2026",
    credits: 85,
    submittedDate: "2026-07-16",
  },
  {
    id: 3,
    user: "Alex Rivera",
    listing: "Cleanroom Suite B",
    company: "CellWorks Bio",
    bookingType: "monthly",
    dateRange: "Aug 1 – Aug 31, 2026",
    credits: 1600,
    submittedDate: "2026-07-14",
  },
  {
    id: 4,
    user: "Marcus Webb",
    listing: "Confocal Microscope",
    company: "Helix Diagnostics",
    bookingType: "daily",
    dateRange: "Jul 25, 2026",
    credits: 120,
    submittedDate: "2026-07-17",
  },
];

export interface PendingPromotion {
  id: number;
  name: string;
  email: string;
  company: string;
  submittedDate: string;
}

// TODO: replace with GET /api/admin/promotions/pending once the backend admin panel exists.
export const MOCK_PENDING_PROMOTIONS: PendingPromotion[] = [
  { id: 1, name: "Elena Vance", email: "elena.vance@novabio.io", company: "NovaBio Therapeutics", submittedDate: "2026-07-10" },
  { id: 2, name: "Nina Alvarez", email: "nina.alvarez@genelabs.com", company: "GeneLabs Inc.", submittedDate: "2026-07-16" },
];
