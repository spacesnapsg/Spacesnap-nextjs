"use client";

import { useState } from "react";
import { Image as ImageIcon, MapPin } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import BookingDatePicker, { addDays, toDateString } from "@/components/BookingDatePicker";
import {
  StripeElementsProvider,
  CardEntryField,
  useCreateCardPaymentMethod,
  stripeConfigured,
} from "@/components/StripeCardField";
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

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  listing: Listing | null;
}

function BookingModalContent({ onClose, listing }: { onClose: () => void; listing: Listing }) {
  const [duration, setDuration] = useState<DurationKey>("daily");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isCollectingCard, setIsCollectingCard] = useState(false);
  const createBooking = useCreateBooking();
  const createCardPaymentMethod = useCreateCardPaymentMethod();

  const activeDuration = DURATIONS.find((d) => d.key === duration) ?? DURATIONS[0];

  const selectedPrice =
    duration === "daily" ? listing.priceDay : duration === "weekly" ? listing.priceWeek : listing.priceMonth;

  const isSubmitting = isCollectingCard || createBooking.isPending;

  async function handleConfirm() {
    if (!selectedDate) return;
    setCardError(null);

    // Card details go straight from the Stripe iframe to Stripe here — the
    // server routes only ever see the resulting pm_... id (replaces the old
    // hardcoded pm_card_visa test token; server wiring unchanged).
    let paymentMethodId: string;
    setIsCollectingCard(true);
    try {
      paymentMethodId = await createCardPaymentMethod();
    } catch (error) {
      setCardError(error instanceof Error ? error.message : "Your card could not be processed.");
      return;
    } finally {
      setIsCollectingCard(false);
    }

    const endDate = addDays(selectedDate, activeDuration.days - 1);
    createBooking.mutate(
      {
        listingId: listing.id,
        bookingType: duration as BookingType,
        startDate: toDateString(selectedDate),
        endDate: toDateString(endDate),
        paymentMethodId,
      },
      { onSuccess: onClose }
    );
  }

  const errorMessage =
    cardError ??
    (createBooking.error instanceof ApiRequestError
      ? createBooking.error.message
      : createBooking.error
        ? "Something went wrong."
        : null);

  return (
    <Modal open onClose={onClose} className="w-full max-w-[480px]">
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

        <BookingDatePicker
          durationDays={activeDuration.days}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <div className="border-t border-border/40 pt-4">
          <CardEntryField />
        </div>

        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

        <Button
          variant="primary"
          disabled={!selectedDate || isSubmitting || !stripeConfigured}
          onClick={handleConfirm}
          className={`w-full ${!selectedDate || isSubmitting || !stripeConfigured ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isSubmitting ? "Confirming…" : "Confirm Booking"}
        </Button>
      </div>
    </Modal>
  );
}

export default function BookingModal({ open, onClose, listing }: BookingModalProps) {
  if (!open || !listing) return null;

  // Content (state included) mounts fresh per open and unmounts on close, so
  // the old handleClose reset bookkeeping is no longer needed.
  return (
    <StripeElementsProvider>
      <BookingModalContent onClose={onClose} listing={listing} />
    </StripeElementsProvider>
  );
}
