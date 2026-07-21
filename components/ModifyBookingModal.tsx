"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import BookingDatePicker, { toDateString } from "@/components/BookingDatePicker";
import {
  StripeElementsProvider,
  CardEntryField,
  useCreateCardPaymentMethod,
  stripeConfigured,
} from "@/components/StripeCardField";
import { useModifyBooking, type UserBooking } from "@/lib/hooks/useUserBookings";
import { calculateModificationTerms, MODIFICATION_FEE_PERCENT } from "@/lib/booking-policy";
import { ApiRequestError } from "@/lib/api-client";

interface ModifyBookingModalProps {
  open: boolean;
  onClose: () => void;
  booking: UserBooking | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// startDate/endDate are date-only "YYYY-MM-DD" strings (serializeBooking),
// which new Date() parses as UTC midnight — safe to diff directly. A
// reschedule preserves duration (the server derives newEndDate itself), so
// the picker only needs the day count for its range highlight.
function bookingDurationDays(booking: UserBooking): number {
  const start = new Date(booking.startDate).getTime();
  const end = new Date(booking.endDate).getTime();
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// User-initiated reschedule (PATCH /api/bookings/[id]/modify, Sprint 4.75).
// The eligibility/fee preview runs the SAME calculator the server executes
// (calculateModificationTerms, lib/booking-policy.ts): notice from the
// booking's CURRENT start date — more than 7 days free, 3-7 days a 20% fee
// (card required, charged immediately) plus a 50% cap on any later
// cancellation refund, under 3 days not modifiable. Server recomputes at
// request time and is the source of truth.
function ModifyBookingModalContent({ onClose, booking }: { onClose: () => void; booking: UserBooking }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isCollectingCard, setIsCollectingCard] = useState(false);
  const modifyBooking = useModifyBooking();
  const createCardPaymentMethod = useCreateCardPaymentMethod();

  const terms = calculateModificationTerms(booking, new Date());
  const durationDays = bookingDurationDays(booking);
  const isFeeTier = terms.eligible && terms.feePercent > 0;
  const feeAmount = (booking.sgdAmount * MODIFICATION_FEE_PERCENT) / 100;

  const isSubmitting = isCollectingCard || modifyBooking.isPending;
  const cardBlocked = isFeeTier && !stripeConfigured;

  async function handleConfirm() {
    if (!selectedDate || !terms.eligible) return;
    setCardError(null);

    let paymentMethodId: string | undefined;
    if (isFeeTier) {
      setIsCollectingCard(true);
      try {
        paymentMethodId = await createCardPaymentMethod();
      } catch (error) {
        setCardError(error instanceof Error ? error.message : "Your card could not be processed.");
        return;
      } finally {
        setIsCollectingCard(false);
      }
    }

    modifyBooking.mutate(
      { bookingId: booking.id, newStartDate: toDateString(selectedDate), paymentMethodId },
      { onSuccess: onClose }
    );
  }

  const errorMessage =
    cardError ??
    (modifyBooking.error instanceof ApiRequestError
      ? modifyBooking.error.message
      : modifyBooking.error
        ? "Something went wrong."
        : null);

  return (
    <Modal open onClose={onClose} className="w-full max-w-[480px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Modify Booking</h2>
      <p className="text-sm text-muted-text mb-4">
        {booking.listingName ? (
          <>
            <span className="text-body-text font-medium">{booking.listingName}</span>, currently{" "}
            {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
          </>
        ) : (
          <>
            Currently {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
          </>
        )}
      </p>

      {!terms.eligible ? (
        <>
          <p className="text-sm text-error-red mb-4">
            This booking starts too soon to be rescheduled — changes need at least 3 days&apos; notice.
            You can still fulfil or cancel it.
          </p>
          <Button type="button" variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded border border-border/40 bg-background px-4 py-3">
            {isFeeTier ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-text">Modification fee</span>
                  <span className="text-body-text font-medium">
                    {MODIFICATION_FEE_PERCENT}% &middot; S${feeAmount.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-text mt-2">
                  Rescheduling 3-7 days before the start date has a {MODIFICATION_FEE_PERCENT}% fee,
                  charged now. Any later cancellation of this booking will be refunded at most 50%.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-text">Modification fee</span>
                  <span className="text-success-green font-medium">Free</span>
                </div>
                <p className="text-xs text-muted-text mt-2">
                  Rescheduling more than 7 days before the start date is free.
                </p>
              </>
            )}
          </div>

          <BookingDatePicker
            durationDays={durationDays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {isFeeTier && <CardEntryField label="Card for the modification fee" />}

          {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Never Mind
            </Button>
            <Button
              type="button"
              disabled={!selectedDate || isSubmitting || cardBlocked}
              onClick={handleConfirm}
              className={`flex-1 ${!selectedDate || isSubmitting || cardBlocked ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? "Rescheduling…" : isFeeTier ? `Reschedule (S$${feeAmount.toFixed(2)})` : "Reschedule"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ModifyBookingModal({ open, onClose, booking }: ModifyBookingModalProps) {
  if (!open || !booking) return null;

  // Content mounts fresh per open (selected date/card state resets on close);
  // the Elements provider is needed for the fee tier's card collection.
  return (
    <StripeElementsProvider>
      <ModifyBookingModalContent onClose={onClose} booking={booking} />
    </StripeElementsProvider>
  );
}
