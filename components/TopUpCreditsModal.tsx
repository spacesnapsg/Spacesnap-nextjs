"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";
import {
  StripeElementsProvider,
  CardEntryField,
  useCreateCardPaymentMethod,
  stripeConfigured,
} from "@/components/StripeCardField";
import { useTopUp } from "@/lib/hooks/useWallet";
import { ApiRequestError } from "@/lib/api-client";

// 2026-07-21: scaled ×10 alongside the credit:SGD ratio change (1 credit =
// S$0.10, see lib/credit-units.ts) so these presets still represent the same
// real top-up amounts (S$10/S$25/S$50/S$100), not a tenth of what they used
// to under the old 1:1 ratio.
const PRESET_AMOUNTS = [1000, 2500, 5000, 10000];

// Presentational SGD preview only — the authoritative conversion happens
// server-side (parseTopUpFields, lib/wallet.ts). 1 credit = S$0.10.
function creditsToSgdDisplay(credits: number): string {
  return (credits * 0.1).toFixed(2);
}

interface TopUpCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

function TopUpCreditsModalContent({ onClose }: { onClose: () => void }) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [isCollectingCard, setIsCollectingCard] = useState(false);
  const topUp = useTopUp();
  const createCardPaymentMethod = useCreateCardPaymentMethod();

  const amount = customAmount ? Number(customAmount) : selectedAmount;
  const isValidAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  const isSubmitting = isCollectingCard || topUp.isPending;

  const errorMessage =
    cardError ??
    (topUp.error instanceof ApiRequestError ? topUp.error.message : topUp.error ? "Something went wrong." : null);

  async function handleSubmit() {
    if (!isValidAmount || amount === null) return;
    setCardError(null);

    // Card details go straight from the Stripe iframe to Stripe — this app
    // only ever sees the resulting pm_... id (same flow as BookingModal).
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

    topUp.mutate({ amount, paymentMethodId }, { onSuccess: onClose });
  }

  return (
    <Modal open onClose={onClose} className="w-full max-w-[480px]">
      <div className="flex flex-col gap-5 pr-4">
        <h3 className="font-semibold text-body-text text-lg leading-snug">Top Up Credits</h3>
        <p className="text-xs text-muted-text -mt-3">
          Your card is charged the equivalent amount (1 credit = S$0.10) and the credits are added to your wallet.
        </p>

        <div className="flex flex-col gap-3">
          {PRESET_AMOUNTS.map((credits) => (
            <button
              key={credits}
              type="button"
              onClick={() => {
                setSelectedAmount(credits);
                setCustomAmount("");
              }}
              className={`flex items-center justify-between rounded border px-4 py-3.5 text-left transition-colors ${
                selectedAmount === credits && !customAmount
                  ? "bg-user-teal-start/10 border-user-teal-start"
                  : "bg-background border-border hover:border-user-teal-start/50"
              }`}
            >
              <span className="text-body-text font-medium">{credits} Credits</span>
              <span className="text-muted-text text-sm">S${creditsToSgdDisplay(credits)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-text">Or enter a custom amount</label>
          <Input
            type="number"
            min="0"
            placeholder="e.g. 150"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setSelectedAmount(null);
            }}
          />
          {isValidAmount && amount !== null && (
            <p className="text-xs text-muted-text">Your card will be charged S${creditsToSgdDisplay(amount)}.</p>
          )}
        </div>

        <div className="border-t border-border/40 pt-4">
          <CardEntryField />
        </div>

        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

        <Button
          type="button"
          disabled={!isValidAmount || isSubmitting || !stripeConfigured}
          onClick={handleSubmit}
          className={`w-full ${!isValidAmount || isSubmitting || !stripeConfigured ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isSubmitting ? "Processing…" : "Confirm Top Up"}
        </Button>
      </div>
    </Modal>
  );
}

export default function TopUpCreditsModal({ open, onClose }: TopUpCreditsModalProps) {
  if (!open) return null;

  // Content (state included) mounts fresh per open and unmounts on close —
  // same pattern as BookingModal, so no manual reset bookkeeping is needed.
  return (
    <StripeElementsProvider>
      <TopUpCreditsModalContent onClose={onClose} />
    </StripeElementsProvider>
  );
}
