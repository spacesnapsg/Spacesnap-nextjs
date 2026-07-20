"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

interface CancellationReviewModalProps {
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  requestName?: string;
  reason?: string | null;
  isSubmitting?: boolean;
}

// Shown when the supplier clicks the warning indicator on a bulk order row
// that has a pending buyer-submitted cancellation request (2026-07-20
// product owner request). Approve moves the order to cancelled; Reject
// clears the request and leaves it confirmed — see approveBulkOrderCancellation/
// rejectBulkOrderCancellation, lib/bulk-orders.ts.
export default function CancellationReviewModal({
  open,
  onClose,
  onApprove,
  onReject,
  requestName,
  reason,
  isSubmitting = false,
}: CancellationReviewModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[480px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Cancellation Requested</h2>
      <p className="text-sm text-muted-text mb-4">
        {requestName ? (
          <>
            <span className="text-body-text font-medium">{requestName}</span>{" "}
            has asked to cancel this confirmed order.
          </>
        ) : (
          "The requester has asked to cancel this confirmed order."
        )}
      </p>
      <div className="bg-background border border-border/40 rounded px-4 py-3 mb-6">
        <p className="text-xs text-muted-text mb-1">Reason given</p>
        <p className="text-sm text-body-text">{reason || "No reason provided."}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={onReject}
          variant="ghost"
          className={`flex-1 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Reject
        </Button>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={onApprove}
          className={`flex-1 !bg-gradient-to-r !from-error-red !to-[#b91c1c] ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Approve Cancellation
        </Button>
      </div>
    </Modal>
  );
}
