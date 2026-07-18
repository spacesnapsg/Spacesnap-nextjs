"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import type { Listing } from "@/lib/mockListings";

interface RequestPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  listing: Listing | null;
}

export default function RequestPurchaseModal({ open, onClose, listing }: RequestPurchaseModalProps) {
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleClose() {
    setNotes("");
    setSubmitted(false);
    onClose();
  }

  if (!open || !listing) return null;

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[440px]">
      {submitted ? (
        <div className="flex flex-col items-center text-center gap-3 py-4 pr-4">
          <span className="h-12 w-12 rounded-full bg-user-teal-start/15 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-user-teal-end" />
          </span>
          <h3 className="font-semibold text-body-text text-lg">Request Submitted</h3>
          <p className="text-sm text-muted-text">
            We&apos;ll notify you when {listing.name} is back in stock.
          </p>
          <Button type="button" className="w-full mt-2" onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pr-4">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-error-red/10 text-error-red border border-error-red/30 rounded-full px-2.5 py-1 text-xs font-medium">
              Out of Stock
            </span>
            <h3 className="font-semibold text-body-text text-lg leading-snug mt-2">{listing.name}</h3>
            <p className="text-sm text-muted-text mt-1">
              This item is currently out of stock. Submit a request and the supplier will notify you
              when it&apos;s available.
            </p>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-1.5">
            <label className="text-xs text-muted-text">Note to supplier (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. quantity needed, timeline..."
              className="w-full rounded bg-background border border-border/40 px-4 py-2.5 text-sm text-body-text placeholder:text-muted-text focus:outline-none focus:border-user-teal-start transition-colors resize-none"
            />
          </div>

          <Button type="button" className="w-full" onClick={() => setSubmitted(true)}>
            Submit Request
          </Button>
        </div>
      )}
    </Modal>
  );
}
