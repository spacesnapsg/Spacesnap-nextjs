"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useTopUp } from "@/lib/hooks/useWallet";
import { ApiRequestError } from "@/lib/api-client";

// 2026-07-21: scaled ×10 alongside the credit:SGD ratio change (1 credit =
// S$0.10, see lib/credit-units.ts) so these presets still represent the same
// real top-up amounts (S$10/S$25/S$50/S$100), not a tenth of what they used
// to under the old 1:1 ratio.
const PRESET_AMOUNTS = [1000, 2500, 5000, 10000];

interface TopUpCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TopUpCreditsModal({ open, onClose }: TopUpCreditsModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const topUp = useTopUp();

  const amount = customAmount ? Number(customAmount) : selectedAmount;
  const isValidAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;

  const handleClose = () => {
    setSelectedAmount(null);
    setCustomAmount("");
    topUp.reset();
    onClose();
  };

  const errorMessage =
    topUp.error instanceof ApiRequestError ? topUp.error.message : topUp.error ? "Something went wrong." : null;

  function handleSubmit() {
    if (!isValidAmount || amount === null) return;
    topUp.mutate(amount, { onSuccess: handleClose });
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[480px]">
      <div className="flex flex-col gap-5 pr-4">
        <h3 className="font-semibold text-body-text text-lg leading-snug">Top Up Credits</h3>
        <p className="text-xs text-muted-text -mt-3">
          Credits-only for now — no real charge is made (payments are planned for Sprint 6).
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
        </div>

        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

        <Button
          type="button"
          disabled={!isValidAmount || topUp.isPending}
          onClick={handleSubmit}
          className={`w-full ${!isValidAmount || topUp.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {topUp.isPending ? "Processing…" : "Confirm Top Up"}
        </Button>
      </div>
    </Modal>
  );
}
