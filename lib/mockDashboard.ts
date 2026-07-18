export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled";
export type BookingType = "daily" | "weekly" | "monthly";

export interface Booking {
  id: number;
  user_id: number;
  listing_id: number;
  booking_type: BookingType;
  start_date: string;
  end_date: string;
  credits: number;
  status: BookingStatus;
}

export interface CheckIn {
  id: number;
  user_id: number;
  listing_id: number;
  booking_id: number | null;
  checked_in_at: string;
  checked_out_at: string | null;
}

export interface DashboardUser {
  id: number;
  name: string;
}

export type ActivityActionType = "booking" | "certification" | "checkin";

export interface ActivityLogEntry {
  id: number;
  user_id: number;
  action_type: ActivityActionType;
  description: string;
  related_listing_id: number | null;
  created_at: string;
}

export const TOTAL_BOOKINGS = 14;

export const MOCK_UPCOMING_BOOKINGS: Booking[] = [
  {
    id: 201,
    user_id: 1,
    listing_id: 4,
    booking_type: "daily",
    start_date: "2026-07-18",
    end_date: "2026-07-18",
    credits: 65,
    status: "confirmed",
  },
  {
    id: 202,
    user_id: 1,
    listing_id: 1,
    booking_type: "daily",
    start_date: "2026-07-22",
    end_date: "2026-07-22",
    credits: 45,
    status: "pending",
  },
];

export const MOCK_DASHBOARD_USERS: DashboardUser[] = [
  { id: 2, name: "Maria" },
  { id: 3, name: "James" },
  { id: 4, name: "Priya" },
  { id: 5, name: "Tom" },
  { id: 6, name: "Sara" },
  { id: 7, name: "Noah" },
];

export const MOCK_ACTIVE_CHECK_INS: CheckIn[] = [
  { id: 301, user_id: 2, listing_id: 1, booking_id: null, checked_in_at: "2026-07-18T08:15:00", checked_out_at: null },
  { id: 302, user_id: 3, listing_id: 7, booking_id: null, checked_in_at: "2026-07-18T08:40:00", checked_out_at: null },
  { id: 303, user_id: 4, listing_id: 4, booking_id: null, checked_in_at: "2026-07-18T09:05:00", checked_out_at: null },
  { id: 304, user_id: 5, listing_id: 2, booking_id: null, checked_in_at: "2026-07-18T09:30:00", checked_out_at: null },
  { id: 305, user_id: 6, listing_id: 5, booking_id: null, checked_in_at: "2026-07-18T09:50:00", checked_out_at: null },
  { id: 306, user_id: 7, listing_id: 4, booking_id: null, checked_in_at: "2026-07-18T10:10:00", checked_out_at: null },
];

export const MOCK_ACTIVITY_LOG: ActivityLogEntry[] = [
  {
    id: 401,
    user_id: 1,
    action_type: "booking",
    description: "Booked BSL-2 Research Suite",
    related_listing_id: 4,
    created_at: "2026-07-16T09:00:00",
  },
  {
    id: 402,
    user_id: 1,
    action_type: "certification",
    description: "Completed Safety Cert",
    related_listing_id: null,
    created_at: "2026-07-13T09:00:00",
  },
  {
    id: 403,
    user_id: 1,
    action_type: "checkin",
    description: "Checked in at NSG BioLabs",
    related_listing_id: null,
    created_at: "2026-07-11T09:00:00",
  },
  {
    id: 404,
    user_id: 1,
    action_type: "booking",
    description: "Booked Wet Lab Bench - Downtown SF",
    related_listing_id: 1,
    created_at: "2026-07-11T09:00:00",
  },
  {
    id: 405,
    user_id: 1,
    action_type: "checkin",
    description: "Checked in at Innovate Labs",
    related_listing_id: null,
    created_at: "2026-07-04T09:00:00",
  },
];
