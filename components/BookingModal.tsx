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
import { useMyRewardGrants } from "@/lib/hooks/useRewardsCatalogue";
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

// A BookingCredit being redeemed against this booking — see
// PendingBookingCreditModal, which is the only caller that ever passes this.
// Purely a client-side preview of the same math createBookingWithDebit
// actually runs (lib/bookings.ts): a card is still always collected (same
// pattern as a reward-grant-covered booking, which also may end up
// charging nothing) since the server, not the client, decides whether
// there's anything left to charge.
export interface AppliedBookingCredit {
  id: string;
  amount: number;
}

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  listing: Listing | null;
  appliedCredit?: AppliedBookingCredit | null;
}

function BookingModalContent({
  onClose,
  listing,
  appliedCredit,
}: {
  onClose: () => void;
  listing: Listing;
  appliedCredit?: AppliedBookingCredit | null;
}) {
  const [duration, setDuration] = useState<DurationKey>("daily");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isCollectingCard, setIsCollectingCard] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string>("");
  const createBooking = useCreateBooking();
  const createCardPaymentMethod = useCreateCardPaymentMethod();
  const { data: rewardGrants } = useMyRewardGrants();

  // Only booking_discount_pct grants apply here — free_consumable_unit is
  // the purchase-flow counterpart (lib/purchases.ts), a different
  // RewardGrantType this modal never redeems.
  const availableVouchers = (rewardGrants ?? []).filter((g) => g.type === "booking_discount_pct");
  const selectedVoucher = availableVouchers.find((g) => g.id === selectedGrantId) ?? null;

  const activeDuration = DURATIONS.find((d) => d.key === duration) ?? DURATIONS[0];

  const selectedPrice =
    duration === "daily" ? listing.priceDay : duration === "weekly" ? listing.priceWeek : listing.priceMonth;

  // Client-side preview only — the server (resolveRewardGrantDiscount,
  // lib/reward-grants.ts) computes the authoritative discount and re-checks
  // the grant is still available/unexpired at charge time. Same ordering as
  // createBookingWithDebit: the voucher discount is applied first, and any
  // rebook BookingCredit only ever covers what's left after it.
  const voucherDiscount = selectedVoucher
    ? Math.min(((selectedPrice ?? 0) * selectedVoucher.value) / 100, selectedPrice ?? 0)
    : 0;
  const priceAfterVoucher = Math.max((selectedPrice ?? 0) - voucherDiscount, 0);

  const creditApplied = appliedCredit ? Math.min(appliedCredit.amount, priceAfterVoucher) : 0;
  const creditLeftover = appliedCredit ? Math.max(appliedCredit.amount - priceAfterVoucher, 0) : 0;
  const amountDue = Math.max(priceAfterVoucher - creditApplied, 0);

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
        ...(appliedCredit ? { bookingCreditId: appliedCredit.id } : {}),
        ...(selectedVoucher ? { rewardGrantId: selectedVoucher.id } : {}),
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

          {availableVouchers.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs text-muted-text mb-1">Have a voucher?</label>
              <select
                value={selectedGrantId}
                onChange={(e) => setSelectedGrantId(e.target.value)}
                className="bg-background border border-border/40 text-body-text rounded h-10 px-3 text-sm focus:outline-none focus:border-user-teal-start transition-colors w-full"
              >
                <option value="">No voucher</option>
                {availableVouchers.map((grant) => (
                  <option key={grant.id} value={grant.id}>
                    {grant.value}% off
                  </option>
                ))}
              </select>
              {selectedVoucher && (
                <p className="text-xs text-success-green mt-1.5">
                  {selectedVoucher.value}% off applied — {voucherDiscount.toFixed(2)} credits saved.
                </p>
              )}
            </div>
          )}

          {appliedCredit && (
            <div className="mt-3 rounded-lg bg-background/60 border border-border/40 px-3 py-2.5 text-sm">
              <p className="text-muted-text">
                Rebooking credit: <span className="text-body-text font-medium">{appliedCredit.amount.toFixed(2)} credits</span>
              </p>
              {amountDue > 0 ? (
                <p className="text-body-text mt-1">
                  Covers {creditApplied.toFixed(2)} credits — you&apos;ll be charged{" "}
                  <span className="font-medium">{amountDue.toFixed(2)} credits</span> to top up the rest.
                </p>
              ) : creditLeftover > 0 ? (
                <p className="text-success-green mt-1">
                  Fully covers this booking — the remaining {creditLeftover.toFixed(2)} credits will be refunded to your card.
                </p>
              ) : (
                <p className="text-success-green mt-1">Fully covers this booking — nothing else charged.</p>
              )}
            </div>
          )}
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

export default function BookingModal({ open, onClose, listing, appliedCredit }: BookingModalProps) {
  if (!open || !listing) return null;

  // Content (state included) mounts fresh per open and unmounts on close, so
  // the old handleClose reset bookkeeping is no longer needed.
  return (
    <StripeElementsProvider>
      <BookingModalContent onClose={onClose} listing={listing} appliedCredit={appliedCredit} />
    </StripeElementsProvider>
  );
}
