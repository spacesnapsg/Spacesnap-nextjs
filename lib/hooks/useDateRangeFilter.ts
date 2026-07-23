import { useState } from "react";
import { presetToDateRange, type ActivityDateRangePreset } from "@/lib/hooks/useActivity";

// Shared page/date-range state + handlers for every paginated audit-trail
// feed (Recent Activity, Credit Movement, wallet Recent Transactions) —
// extracted 2026-07-23 after the third near-identical copy of this state
// block (preset/from/to/page plus the four change handlers that reset page
// to 1) showed up across app/(user)/user/page.tsx and
// ManageBuyerOrganizationModal.tsx. Pairs with components/DateRangePicker.tsx.
export function useDateRangeFilter(initialPreset: ActivityDateRangePreset = "all") {
  const [preset, setPreset] = useState<ActivityDateRangePreset>(initialPreset);
  const initialRange = presetToDateRange(initialPreset);
  const [from, setFrom] = useState<string | null>(initialRange.from);
  const [to, setTo] = useState<string | null>(initialRange.to);
  const [page, setPage] = useState(1);

  function changePreset(next: ActivityDateRangePreset) {
    setPreset(next);
    setPage(1);
    const range = presetToDateRange(next);
    setFrom(range.from);
    setTo(range.to);
  }

  function changeFrom(value: string) {
    setPreset("custom");
    setFrom(value || null);
    setPage(1);
  }

  function changeTo(value: string) {
    setPreset("custom");
    setTo(value || null);
    setPage(1);
  }

  // For callers with an additional, non-date filter (e.g. the dashboard's
  // category pills) that should also reset paging back to page 1.
  function resetPage() {
    setPage(1);
  }

  return { preset, from, to, page, setPage, changePreset, changeFrom, changeTo, resetPage };
}
