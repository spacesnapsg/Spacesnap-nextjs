"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

interface DeclineReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  requestName?: string;
}

export default function DeclineReasonModal({ open, onClose, onConfirm, requestName }: DeclineReasonModalProps) {
  const [reason, setReason] = useState("");

  function handleClose() {
    setReason("");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(reason);
    setReason("");
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[480px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Decline Request</h2>
      <p className="text-sm text-muted-text mb-6">
        {requestName ? (
          <>
            Let <span className="text-body-text font-medium">{requestName}</span> know why this request is being
            declined.
          </>
        ) : (
          "Let the requestor know why this request is being declined."
        )}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-muted-text">Reason for declining</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="e.g. Requested dates are unavailable, missing certification..."
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-supplier-purple-start transition-colors resize-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1 !bg-gradient-to-r !from-error-red !to-[#b91c1c]">
            Decline Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
