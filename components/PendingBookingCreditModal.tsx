"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Image as ImageIcon, MapPin } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import BookingModal, { type AppliedBookingCredit } from "@/components/BookingModal";
import { useListings, type Listing, type ListingType } from "@/lib/hooks/useListings";
import { usePendingResolutionBookings, useClaimBookingCreditRefund } from "@/lib/hooks/usePendingBookingCredits";
import { ApiRequestError } from "@/lib/api-client";

type TypeFilter = "all" | Extract<ListingType, "space" | "equipment">;

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "space", label: "Spaces" },
  { key: "equipment", label: "Equipment" },
];

const TYPE_BADGE_STYLES: Record<"space" | "equipment", string> = {
  space: "bg-user-teal-start/15 text-user-teal-end border-user-teal-start/30",
  equipment: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

// Shown on (user) layout mount whenever the caller has an unresolved
// supplier-declined booking (see GET /api/bookings/pending-resolution) —
// deliberately not a symmetric "refund or rebook" choice: alternatives are
// surfaced first to encourage rebooking (stickiness), with "refund me
// instead" as the last card in the scroll, not an upfront fork. Per-session
// dismissible (closing it doesn't resolve anything, so it reappears on the
// next full page load/login as long as something is still unresolved — see
// the component's own re-mount-driven auto-open below).
export default function PendingBookingCreditModal() {
  const { data: pendingBookings } = usePendingResolutionBookings();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<"intro" | "browse">("intro");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const claimRefund = useClaimBookingCreditRefund();

  const { data: listings } = useListings();

  // Operate on the oldest unresolved booking first — if more than one is
  // somehow outstanding, resolving this one re-queries and the modal picks
  // up the next automatically (usePendingResolutionBookings invalidates on
  // both the rebook and refund-claim paths).
  const pending = pendingBookings?.[0] ?? null;

  const bookableListings = useMemo(
    () =>
      (listings ?? []).filter(
        (listing) => (listing.type === "space" || listing.type === "equipment") && (typeFilter === "all" || listing.type === typeFilter)
      ),
    [listings, typeFilter]
  );

  if (!pending || dismissed) return null;

  const appliedCredit: AppliedBookingCredit | null = pending.credit ? { id: pending.credit.id, amount: pending.credit.amount } : null;

  function handleClose() {
    setDismissed(true);
    setStep("intro");
  }

  return (
    <>
      <Modal open={!selectedListing} onClose={handleClose} className="w-full max-w-[560px]">
        {step === "intro" ? (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="h-14 w-14 rounded-full bg-error-red/10 flex items-center justify-center">
              <AlertTriangle size={26} className="text-error-red" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-body-text">Your booking was cancelled by the supplier</h3>
              <p className="text-sm text-muted-text mt-2">
                {pending.listingName ?? "Your booking"} ({pending.startDate}) was declined. You have{" "}
                <span className="text-body-text font-medium">{pending.credit?.amount.toFixed(2) ?? "0.00"} credits</span> — pick a
                new space or equipment to rebook.
              </p>
            </div>
            <Button variant="primary" onClick={() => setStep("browse")} className="w-full mt-2">
              Next <ArrowRight size={16} className="inline ml-1" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold text-body-text">Pick a new space or equipment</h3>
              <p className="text-sm text-muted-text mt-1">
                Your {pending.credit?.amount.toFixed(2) ?? "0.00"} credits will be applied automatically.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((filter) => {
                const isActive = typeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setTypeFilter(filter.key)}
                    className={`h-8 px-3.5 rounded-full text-sm font-medium border transition-colors ${
                      isActive
                        ? "bg-user-teal-start/20 border-user-teal-start text-user-teal-end"
                        : "bg-background border-border text-muted-text hover:text-body-text"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
              {bookableListings.map((listing) => (
                <button
                  key={listing.id}
                  type="button"
                  onClick={() => setSelectedListing(listing)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/60 hover:bg-background p-3 text-left transition-colors"
                >
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-card flex items-center justify-center">
                    <ImageIcon size={18} className="text-muted-text" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-body-text truncate">{listing.name}</p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${TYPE_BADGE_STYLES[listing.type as "space" | "equipment"]}`}
                      >
                        {listing.type}
                      </span>
                    </div>
                    {listing.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-text mt-0.5">
                        <MapPin size={12} />
                        {listing.location}
                      </div>
                    )}
                  </div>
                  <p className="shrink-0 text-sm text-body-text font-medium">{listing.priceDay} cr/day</p>
                </button>
              ))}
              {bookableListings.length === 0 && (
                <p className="text-sm text-muted-text text-center py-6">No listings match this filter.</p>
              )}

              {/* Last card in the scroll — the explicit fallback, not an upfront choice. */}
              <div className="rounded-xl border border-dashed border-border p-3 text-center">
                <p className="text-sm text-muted-text mb-2">None of these work for you?</p>
                <Button
                  variant="ghost"
                  disabled={claimRefund.isPending}
                  onClick={() => claimRefund.mutate(pending.id, { onSuccess: () => setDismissed(true) })}
                  className="w-full"
                >
                  {claimRefund.isPending ? "Refunding…" : "Refund me instead"}
                </Button>
                {claimRefund.isError && (
                  <p className="text-sm text-error-red mt-2">
                    {claimRefund.error instanceof ApiRequestError ? claimRefund.error.message : "Something went wrong."}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <BookingModal
        open={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        listing={selectedListing}
        appliedCredit={appliedCredit}
      />
    </>
  );
}
