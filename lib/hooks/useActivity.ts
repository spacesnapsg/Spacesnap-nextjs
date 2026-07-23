import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Mirrors the Prisma `ActivityActionType` enum (prisma/schema.prisma) as a
// plain string union — frontend code doesn't import the generated Prisma
// client (see lib/hooks/useUserBookings.ts's BookingStatus for the same
// convention), so this list has to be kept in sync by hand if the enum grows.
// Must stay in sync with prisma/schema.prisma's ActivityActionType enum — a
// value the API can return but this union doesn't know crashes the dashboard
// feed (ACTIVITY_ICONS is keyed exhaustively off this union). Found the hard
// way 2026-07-21: booking_cancelled/booking_modified/
// bulk_order_confirmed_despite_insufficient_credit had landed in the schema
// across three earlier backend sessions without this side being updated.
export type ActivityActionType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_modified"
  | "booking_completed"
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
  | "instant_purchase_completed"
  | "bulk_order_confirmed_despite_insufficient_credit"
  | "booking_declined_pending_resolution"
  | "booking_credit_granted"
  | "booking_credit_redeemed"
  | "booking_credit_refunded";

export interface ActivityEntry {
  id: string;
  actionType: ActivityActionType;
  description: string;
  relatedListingId: string | null;
  listingName: string | null;
  relatedTrainingSessionId: string | null;
  trainingSessionTitle: string | null;
  createdAt: string;
}

export type ActivityCategory = "bookings" | "bulk_orders" | "purchases" | "wallet" | "check_ins" | "training" | "certificates";

// Purely a display/filter grouping — the API itself only knows raw action
// types (?types=a,b,c). Keeping the grouping here means adding a category
// never requires a backend change.
export const ACTIVITY_CATEGORIES: Record<ActivityCategory, { label: string; types: ActivityActionType[] }> = {
  bookings: {
    label: "Bookings",
    types: [
      "booking_created",
      "booking_confirmed",
      "booking_declined",
      "booking_cancelled",
      "booking_modified",
      "booking_completed",
      "booking_declined_pending_resolution",
      "booking_credit_granted",
      "booking_credit_redeemed",
      "booking_credit_refunded",
    ],
  },
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
      "bulk_order_confirmed_despite_insufficient_credit",
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

// 2026-07-23: replaced the old server-side "days" preset (7/30/90/all) with
// a real from/to date range so the UI can offer an actual date-range picker,
// not just fixed buckets. These presets are now purely a frontend
// convenience — clicking one just computes from/to and sends those, the
// same as a manually-picked custom range would.
export type ActivityDateRangePreset = "all" | "7" | "30" | "90" | "custom";

export const ACTIVITY_DATE_RANGE_PRESETS: Record<ActivityDateRangePreset, string> = {
  all: "All time",
  "7": "Past 7 days",
  "30": "Past 30 days",
  "90": "Past quarter",
  custom: "Custom",
};

export function presetToDateRange(preset: ActivityDateRangePreset): { from: string | null; to: string | null } {
  if (preset === "all" || preset === "custom") return { from: null, to: null };
  const days = Number(preset);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: null };
}

export interface ActivityDateRange {
  from: string | null; // "YYYY-MM-DD"
  to: string | null; // "YYYY-MM-DD"
}

export interface ActivityPageResult {
  activity: ActivityEntry[];
  meta: { page: number; pageSize: number; total: number };
}

export function useActivity(category: ActivityCategory | "all", dateRange: ActivityDateRange, page: number) {
  const types = category === "all" ? null : ACTIVITY_CATEGORIES[category].types;
  const params = new URLSearchParams();
  if (types) params.set("types", types.join(","));
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  params.set("page", String(page));
  const qs = params.toString();

  return useQuery({
    queryKey: ["activity", category, dateRange, page],
    queryFn: () => apiFetch<ActivityPageResult>(`/api/activity?${qs}`),
    placeholderData: (previousData) => previousData,
  });
}
