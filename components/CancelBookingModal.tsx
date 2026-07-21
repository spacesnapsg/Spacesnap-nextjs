"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useCancelBooking, type UserBooking } from "@/lib/hooks/useUserBookings";
import {
  calculateUserCancellationRefund,
  applyRefundCap,
  daysBeforeSessionStart,
} from "@/lib/booking-policy";
import { ApiRequestError } from "@/lib/api-client";

interface CancelBookingModalProps {
  open: boolean;
  onClose: () => void;
  booking: UserBooking | null;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// User-initiated booking cancellation (PATCH /api/bookings/[id]/cancel).
// The refund preview runs the SAME calculators the server executes
// (lib/booking-policy.ts — day tier capped by the booking's own
// maxRefundablePercent from a prior reschedule), so what's shown here is
// what cancelBookingWithRefund will pay; the server still recomputes at
// request time and is the source of truth.
export default function CancelBookingModal({ open, onClose, booking }: CancelBookingModalProps) {
  const [reason, setReason] = useState("");
  const cancelBooking = useCancelBooking();

  if (!open || !booking) return null;

  const now = new Date();
  const noticeDays = daysBeforeSessionStart(booking, now);
  const standardPercent = calculateUserCancellationRefund(booking, now);
  const refundPercent = applyRefundCap(standardPercent, booking.maxRefundablePercent);
  const refundAmount = (booking.sgdAmount * refundPercent) / 100;
  const isCapped = refundPercent < standardPercent;

  function handleClose() {
    setReason("");
    cancelBooking.reset();
    onClose();
  }

  function handleConfirm() {
    if (!booking) return;
    cancelBooking.mutate(
      { bookingId: booking.id, reason: reason.trim() || undefined },
      { onSuccess: handleClose }
    );
  }

  const errorMessage =
    cancelBooking.error instanceof ApiRequestError
      ? cancelBooking.error.message
      : cancelBooking.error
        ? "Something went wrong."
        : null;

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[480px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Cancel Booking</h2>
      <p className="text-sm text-muted-text mb-4">
        {booking.listingName ? (
          <>
            <span className="text-body-text font-medium">{booking.listingName}</span>,{" "}
            {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
          </>
        ) : (
          <>
            {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
          </>
        )}
      </p>

      <div className="rounded border border-border/40 bg-background px-4 py-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-text">Refund</span>
          <span className="text-body-text font-medium">
            {refundPercent}% &middot; S${refundAmount.toFixed(2)} of S${booking.sgdAmount.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-muted-text mt-2">
          {noticeDays >= 7
            ? "Cancelling 7 or more days before the start date refunds 100%."
            : noticeDays >= 3
              ? "Cancelling 3-6 days before the start date refunds 50%."
              : "Cancelling under 3 days before the start date is non-refundable."}
          {isCapped && (
            <>
              {" "}
              Because this booking was rescheduled, its refund is capped at{" "}
              {booking.maxRefundablePercent}%.
            </>
          )}
        </p>
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-text">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Plans changed..."
          className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-user-teal-start transition-colors resize-none"
        />
      </div>

      {errorMessage && <p className="text-sm text-error-red mb-4">{errorMessage}</p>}

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
          Keep Booking
        </Button>
        <Button
          type="button"
          disabled={cancelBooking.isPending}
          onClick={handleConfirm}
          className={`flex-1 ${cancelBooking.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {cancelBooking.isPending ? "Cancelling…" : "Cancel Booking"}
        </Button>
      </div>
    </Modal>
  );
}
