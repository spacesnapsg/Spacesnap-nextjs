"use client";

import { useState } from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useCreateBulkOrder, type Listing } from "@/lib/hooks/useListings";
import { ApiRequestError } from "@/lib/api-client";

interface RequestPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  listing: Listing | null;
}

export default function RequestPurchaseModal({ open, onClose, listing }: RequestPurchaseModalProps) {
  const [quantity, setQuantity] = useState(1);
  const createBulkOrder = useCreateBulkOrder();

  function handleClose() {
    setQuantity(1);
    createBulkOrder.reset();
    onClose();
  }

  if (!open || !listing) return null;

  const isOutOfStock = (listing.stockQuantity ?? 0) <= 0;
  const cost = (listing.pricePerUnit ?? 0) * quantity;
  const errorMessage =
    createBulkOrder.error instanceof ApiRequestError
      ? createBulkOrder.error.message
      : createBulkOrder.error
        ? "Something went wrong."
        : null;

  function handleSubmit() {
    if (!listing) return;
    createBulkOrder.mutate({ listingId: listing.id, quantity });
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[440px]">
      {createBulkOrder.isSuccess ? (
        <div className="flex flex-col items-center text-center gap-3 py-4 pr-4">
          <span className="h-12 w-12 rounded-full bg-user-teal-start/15 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-user-teal-end" />
          </span>
          <h3 className="font-semibold text-body-text text-lg">Order Submitted</h3>
          <p className="text-sm text-muted-text">
            Your request for {listing.name} is pending approval. {cost} credits have been reserved.
          </p>
          <Button type="button" className="w-full mt-2" onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pr-4">
          <div>
            {isOutOfStock && (
              <span className="inline-flex items-center gap-1.5 bg-error-red/10 text-error-red border border-error-red/30 rounded-full px-2.5 py-1 text-xs font-medium">
                Out of Stock
              </span>
            )}
            <h3 className="font-semibold text-body-text text-lg leading-snug mt-2">{listing.name}</h3>
            <p className="text-sm text-muted-text mt-1">
              {isOutOfStock
                ? "This item is currently out of stock. Submitting still places your order — the supplier will fulfill it once restocked."
                : "Choose a quantity to submit your order."}
            </p>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-1.5">
            <label className="text-xs text-muted-text">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="h-9 w-9 flex items-center justify-center rounded border border-border text-muted-text hover:text-body-text hover:bg-background transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-body-text font-medium w-8 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                className="h-9 w-9 flex items-center justify-center rounded border border-border text-muted-text hover:text-body-text hover:bg-background transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            <p className="text-body-text font-medium mt-2">{cost} credits</p>
          </div>

          {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

          <Button
            type="button"
            className={`w-full ${createBulkOrder.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={createBulkOrder.isPending}
            onClick={handleSubmit}
          >
            {createBulkOrder.isPending ? "Submitting…" : "Submit Order"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
