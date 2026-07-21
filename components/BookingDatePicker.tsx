"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Extracted verbatim from BookingModal.tsx (2026-07-21) so the Modify Booking
// modal can reuse the identical picker — a reschedule preserves the booking's
// duration, so it needs the same durationDays-driven range highlight.

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date | null, b: Date | null) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatShort(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildCalendarCells(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(startWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  return cells;
}

export default function BookingDatePicker({
  durationDays,
  selectedDate,
  onSelectDate,
}: {
  durationDays: number;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}) {
  const today = startOfDay(new Date());
  const [viewDate, setViewDate] = useState(
    startOfDay(new Date(today.getFullYear(), today.getMonth(), 1))
  );

  const cells = buildCalendarCells(viewDate);
  const rangeEnd = selectedDate ? addDays(selectedDate, durationDays - 1) : null;
  const isPrevDisabled =
    viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();

  return (
    <div className="border-t border-border/40 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-text">Select a date</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPrevDisabled}
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            aria-label="Previous month"
            className={`h-7 w-7 flex items-center justify-center rounded border border-border text-muted-text transition-colors ${
              isPrevDisabled ? "opacity-30 cursor-not-allowed" : "hover:text-body-text hover:bg-background"
            }`}
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-sm text-body-text font-medium w-28 text-center">
            {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <button
            type="button"
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            aria-label="Next month"
            className="h-7 w-7 flex items-center justify-center rounded border border-border text-muted-text hover:text-body-text hover:bg-background transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <p key={i} className="text-xs text-muted-text py-1">
            {label}
          </p>
        ))}

        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const isPast = date < today;
          const isStart = isSameDay(date, selectedDate);
          const isInRange =
            !!selectedDate && !isStart && date > selectedDate && !!rangeEnd && date <= rangeEnd;

          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(date)}
              className={`h-8 w-8 mx-auto flex items-center justify-center rounded text-sm transition-colors ${
                isPast
                  ? "text-muted-text/30 cursor-not-allowed"
                  : isStart
                    ? "bg-user-teal-start text-white font-medium"
                    : isInRange
                      ? "bg-user-teal-start/25 text-user-teal-end"
                      : "text-body-text hover:bg-background"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {selectedDate && rangeEnd && (
        <p className="text-sm text-muted-text mt-3">
          Booking window: <span className="text-body-text">{formatShort(selectedDate)}</span> –{" "}
          <span className="text-body-text">{formatShort(rangeEnd)}</span> ({durationDays} day
          {durationDays > 1 ? "s" : ""})
        </p>
      )}
    </div>
  );
}
