"use client";

import { ACTIVITY_DATE_RANGE_PRESETS, type ActivityDateRangePreset } from "@/lib/hooks/useActivity";

interface DateRangePickerProps {
  preset: ActivityDateRangePreset;
  from: string | null;
  to: string | null;
  onPresetChange: (preset: ActivityDateRangePreset) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const PRESET_OPTIONS: ActivityDateRangePreset[] = ["all", "7", "30", "90"];

// Shared preset pills + From/To date inputs — extracted 2026-07-23 so every
// paginated audit-trail feed (Recent Activity, Credit Movement, wallet
// Recent Transactions) gets the same control instead of a bespoke copy per
// page. Pairs with lib/hooks/useDateRangeFilter.ts.
export default function DateRangePicker({ preset, from, to, onPresetChange, onFromChange, onToChange }: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onPresetChange(option)}
            className={`h-7 px-2.5 rounded-full text-xs font-medium border transition-colors ${
              preset === option
                ? "bg-user-teal-start/15 border-user-teal-start text-user-teal-end"
                : "bg-card border-border text-muted-text hover:text-body-text"
            }`}
          >
            {ACTIVITY_DATE_RANGE_PRESETS[option]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from ?? ""}
          max={to ?? undefined}
          onChange={(e) => onFromChange(e.target.value)}
          aria-label="From date"
          className="h-7 px-2 rounded border border-border bg-card text-body-text text-xs"
        />
        <span className="text-xs text-muted-text">–</span>
        <input
          type="date"
          value={to ?? ""}
          min={from ?? undefined}
          onChange={(e) => onToChange(e.target.value)}
          aria-label="To date"
          className="h-7 px-2 rounded border border-border bg-card text-body-text text-xs"
        />
      </div>
    </div>
  );
}
