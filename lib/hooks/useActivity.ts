import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ActivityActionType as PrismaActivityActionType } from "@/app/generated/prisma/client";

// Was a hand-maintained plain string union (frontend code generally doesn't
// import the generated Prisma client — see lib/hooks/useUserBookings.ts's
// BookingStatus for the same convention elsewhere) until it drifted twice:
// 2026-07-21 (booking_cancelled/booking_modified/
// bulk_order_confirmed_despite_insufficient_credit landed in the schema
// without this union being updated) and again 2026-07-27/28 (the three
// internal_training_* values below). Both times the drift was invisible to
// `tsc` and only surfaced as a runtime crash in ACTIVITY_ICONS
// (app/(user)/user/page.tsx), which is keyed exhaustively off this type.
// A type-only import has zero runtime cost (fully erased by tsc, same as
// the CredentialProvenance import in lib/credential-provenance.ts and the
// client components that consume it) — aliasing directly to the real enum
// makes this type structurally impossible to drift again, and turns the
// next such omission into a compile error instead of a production crash.
export type ActivityActionType = PrismaActivityActionType;

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
    types: [
      "training_enrolled",
      "training_waitlisted",
      "training_waitlist_approved",
      "training_session_created",
      "quiz_attempt_submitted",
      "internal_training_event_created",
      "internal_training_evidence_uploaded",
      "internal_training_participant_reviewed",
    ],
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
