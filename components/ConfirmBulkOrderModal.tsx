"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

interface ConfirmBulkOrderModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (estimatedDeliveryDate: string) => void;
  requestName?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
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
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text rounded px-4 py-3 focus:outline-none focus:border-supplier-purple-start transition-colors"
          />
        </div>
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
      </form>
    </Modal>
  );
}
