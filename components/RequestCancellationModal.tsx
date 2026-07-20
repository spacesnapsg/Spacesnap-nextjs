"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

interface RequestCancellationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  listingName?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

// Buyer-facing counterpart to DeclineReasonModal — used once a bulk order is
// already confirmed, so cancelling needs a reason for the supplier to review
// (see requestBulkOrderCancellation, lib/bulk-orders.ts). A still-pending
// order skips this entirely and cancels immediately with no reason needed.
export default function RequestCancellationModal({
  open,
  onClose,
  onConfirm,
  listingName,
  isSubmitting = false,
  errorMessage,
}: RequestCancellationModalProps) {
  const [reason, setReason] = useState("");

  function handleClose() {
    setReason("");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[480px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Request Cancellation</h2>
      <p className="text-sm text-muted-text mb-6">
        {listingName ? (
          <>
            This order for <span className="text-body-text font-medium">{listingName}</span>{" "}
            has already been confirmed — the supplier will review your request before it&apos;s cancelled.
          </>
        ) : (
          "This order has already been confirmed — the supplier will review your request before it's cancelled."
        )}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-muted-text">Reason for cancelling</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            required
            placeholder="e.g. No longer needed, ordered by mistake..."
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-user-teal-start transition-colors resize-none"
          />
        </div>
        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Never Mind
          </Button>
          <Button
            type="submit"
            disabled={!reason.trim() || isSubmitting}
            className={`flex-1 ${!reason.trim() || isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSubmitting ? "Submitting…" : "Request Cancellation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
