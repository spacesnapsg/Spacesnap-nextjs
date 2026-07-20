import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Mirrors the Prisma `ActivityActionType` enum (prisma/schema.prisma) as a
// plain string union — frontend code doesn't import the generated Prisma
// client (see lib/hooks/useUserBookings.ts's BookingStatus for the same
// convention), so this list has to be kept in sync by hand if the enum grows.
export type ActivityActionType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_declined"
  | "bulk_order_created"
  | "bulk_order_confirmed"
  | "bulk_order_declined"
  | "bulk_order_fulfilled"
  | "bulk_order_cancelled"
  | "bulk_order_cancellation_requested"
  | "bulk_order_cancellation_approved"
  | "bulk_order_cancellation_rejected"
  | "wallet_topup"
  | "check_in"
  | "check_out"
  | "training_enrolled"
  | "training_waitlisted"
  | "training_waitlist_approved"
  | "training_session_created"
  | "quiz_attempt_submitted"
  | "credential_issued"
  | "signoff_requested"
  | "signoff_reviewed"
  | "instant_purchase_completed";

export interface ActivityEntry {
  id: string;
  actionType: ActivityActionType;
  description: string;
  relatedListingId: string | null;
  listingName: string | null;
  createdAt: string;
}

export type ActivityCategory = "bookings" | "bulk_orders" | "purchases" | "wallet" | "check_ins" | "training" | "certificates";

// Purely a display/filter grouping — the API itself only knows raw action
// types (?types=a,b,c). Keeping the grouping here means adding a category
// never requires a backend change.
export const ACTIVITY_CATEGORIES: Record<ActivityCategory, { label: string; types: ActivityActionType[] }> = {
  bookings: { label: "Bookings", types: ["booking_created", "booking_confirmed", "booking_declined"] },
  bulk_orders: {
    label: "Bulk Orders",
    types: [
      "bulk_order_created",
      "bulk_order_confirmed",
      "bulk_order_declined",
      "bulk_order_fulfilled",
      "bulk_order_cancelled",
      "bulk_order_cancellation_requested",
      "bulk_order_cancellation_approved",
      "bulk_order_cancellation_rejected",
    ],
  },
  purchases: { label: "Purchases", types: ["instant_purchase_completed"] },
  wallet: { label: "Wallet", types: ["wallet_topup"] },
  check_ins: { label: "Check-ins", types: ["check_in", "check_out"] },
  training: {
    label: "Training",
    types: ["training_enrolled", "training_waitlisted", "training_waitlist_approved", "training_session_created", "quiz_attempt_submitted"],
  },
  certificates: { label: "Certificates", types: ["credential_issued", "signoff_requested", "signoff_reviewed"] },
};

export type ActivityDateRange = "all" | "7" | "30" | "90";

export const ACTIVITY_DATE_RANGES: Record<ActivityDateRange, string> = {
  all: "All time",
  "7": "Past 7 days",
  "30": "Past 30 days",
  "90": "Past quarter",
};

export function useActivity(category: ActivityCategory | "all", dateRange: ActivityDateRange) {
  const types = category === "all" ? null : ACTIVITY_CATEGORIES[category].types;
  const params = new URLSearchParams();
  if (types) params.set("types", types.join(","));
  if (dateRange !== "all") params.set("days", dateRange);
  const qs = params.toString();

  return useQuery({
    queryKey: ["activity", category, dateRange],
    queryFn: () => apiFetch<{ activity: ActivityEntry[] }>(`/api/activity${qs ? `?${qs}` : ""}`),
    select: (data) => data.activity,
  });
}
