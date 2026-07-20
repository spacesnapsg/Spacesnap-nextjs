"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

// Credit-hold feature (2026-07-20 product owner): the buyer's available
// credit is checked at confirm, but it's a warning, not a hard block — the
// supplier sees this and can choose to push ahead via "Confirm Anyway."
export interface InsufficientCreditWarning {
  available: number;
  required: number;
}

interface ConfirmBulkOrderModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (estimatedDeliveryDate: string, override?: boolean) => void;
  requestName?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  creditWarning?: InsufficientCreditWarning | null;
}

// Estimated delivery date is required on confirm (2026-07-20 product owner
// request) — the supplier can't one-click Confirm anymore, this modal is the
// gate for that field.
export default function ConfirmBulkOrderModal({
  open,
  onClose,
  onConfirm,
  requestName,
  isSubmitting = false,
  errorMessage,
  creditWarning,
}: ConfirmBulkOrderModalProps) {
  const [date, setDate] = useState("");

  function handleClose() {
    setDate("");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    onConfirm(date);
  }

  function handleConfirmAnyway() {
    if (!date) return;
    onConfirm(date, true);
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[440px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Confirm Request</h2>
      <p className="text-sm text-muted-text mb-6">
        {requestName ? (
          <>
            Give <span className="text-body-text font-medium">{requestName}</span>{" "}
            an estimated delivery week before confirming.
          </>
        ) : (
          "Give the requester an estimated delivery week before confirming."
        )}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-muted-text">Estimated delivery week</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={!!creditWarning}
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text rounded px-4 py-3 focus:outline-none focus:border-supplier-purple-start transition-colors disabled:opacity-60"
          />
        </div>

        {creditWarning ? (
          <div className="flex flex-col gap-3 rounded border border-amber/30 bg-amber/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber shrink-0 mt-0.5" />
              <p className="text-sm text-amber">
                {requestName ? requestName : "This requester"} only has {creditWarning.available} cr available right
                now, but this order costs {creditWarning.required} cr. Confirming anyway holds the order at
                fulfillment risk — the debit only happens once you fulfill it.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAnyway}
                disabled={isSubmitting}
                // Button's `primary` variant paints a teal background-image
                // gradient that a plain `!bg-amber` (background-color only)
                // can't cover — same root cause as the Fulfill-button gradient
                // bug documented elsewhere in this codebase. `!bg-none` clears
                // the gradient image first so the solid amber color underneath
                // is actually visible.
                className={`flex-1 !bg-none !bg-amber hover:!bg-amber/80 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSubmitting ? "Confirming…" : "Confirm Anyway"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!date || isSubmitting}
                className={`flex-1 !bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end ${
                  !date || isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting ? "Confirming…" : "Confirm Request"}
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
