"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, MapPin } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useCreateBooking, type BookingType, type Listing } from "@/lib/hooks/useListings";
import { ApiRequestError } from "@/lib/api-client";

const TYPE_BADGE_STYLES: Record<Listing["type"], string> = {
  space: "bg-user-teal-start/15 text-user-teal-end border-user-teal-start/30",
  equipment: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  consumables: "bg-amber/15 text-amber border-amber/30",
};

const DURATIONS = [
  { key: "daily", label: "Daily", days: 1 },
  { key: "weekly", label: "Weekly", days: 7 },
  { key: "monthly", label: "Monthly", days: 30 },
] as const;

type DurationKey = (typeof DURATIONS)[number]["key"];

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function toDateString(date: Date) {
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

function formatShort(date: Date) {
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

function DatePicker({
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

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  listing: Listing | null;
}

export default function BookingModal({ open, onClose, listing }: BookingModalProps) {
  const [duration, setDuration] = useState<DurationKey>("daily");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const createBooking = useCreateBooking();

  if (!open || !listing) return null;

  const activeDuration = DURATIONS.find((d) => d.key === duration) ?? DURATIONS[0];

  const selectedPrice =
    duration === "daily" ? listing.priceDay : duration === "weekly" ? listing.priceWeek : listing.priceMonth;

  function handleClose() {
    setDuration("daily");
    setSelectedDate(null);
    createBooking.reset();
    onClose();
  }

  function handleConfirm() {
    if (!selectedDate || !listing) return;
    const endDate = addDays(selectedDate, activeDuration.days - 1);
    createBooking.mutate(
      {
        listingId: listing.id,
        bookingType: duration as BookingType,
        startDate: toDateString(selectedDate),
        endDate: toDateString(endDate),
      },
      { onSuccess: handleClose }
    );
  }

  const errorMessage =
    createBooking.error instanceof ApiRequestError ? createBooking.error.message : createBooking.error ? "Something went wrong." : null;

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[480px]">
      <div className="flex flex-col gap-5">
        <div className="flex gap-4 pr-6">
          <div className="h-20 w-20 shrink-0 rounded-xl bg-background flex items-center justify-center">
            <ImageIcon size={24} className="text-muted-text" />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="font-semibold text-body-text leading-snug">{listing.name}</h3>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${TYPE_BADGE_STYLES[listing.type]}`}
              >
                {listing.type}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-text">
              <MapPin size={14} />
              {listing.location}
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 pt-4">
          <p className="text-sm text-muted-text mb-2">Duration</p>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDuration(d.key)}
                className={`flex-1 h-9 rounded-full text-sm font-medium border transition-colors ${
                  duration === d.key
                    ? "bg-user-teal-start text-white border-user-teal-start"
                    : "bg-background border-border text-muted-text hover:text-body-text"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-body-text font-medium mt-3">{selectedPrice} credits</p>
        </div>

        <DatePicker
          durationDays={activeDuration.days}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

        <Button
          variant="primary"
          disabled={!selectedDate || createBooking.isPending}
          onClick={handleConfirm}
          className={`w-full ${!selectedDate || createBooking.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {createBooking.isPending ? "Confirming…" : "Confirm Booking"}
        </Button>
      </div>
    </Modal>
  );
}
