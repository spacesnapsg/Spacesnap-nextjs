"use client";

import { useState } from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useCreateBulkOrder, useCreatePurchase, type Listing } from "@/lib/hooks/useListings";
import { ApiRequestError } from "@/lib/api-client";

interface RequestPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  listing: Listing | null;
  // "quick" is the one-click "Buy Now" path — an immediate, completed sale
  // (POST /api/purchases: stock and credits move at creation, quantity
  // locked at 1). "bulk" is the multi-unit request path (POST
  // /api/bulk-order-requests: pending until the supplier acts on it). These
  // are different endpoints, not a flag on one — see the Purchase model's
  // comment in schema.prisma for why "Buy Now" isn't a BulkOrderRequest.
  mode?: "quick" | "bulk";
}

export default function RequestPurchaseModal({
  open,
  onClose,
  listing,
  mode = "bulk",
}: RequestPurchaseModalProps) {
  const [quantity, setQuantity] = useState(1);
  const isQuick = mode === "quick";

  const createPurchase = useCreatePurchase();
  const createBulkOrder = useCreateBulkOrder();
  const mutation = isQuick ? createPurchase : createBulkOrder;

  function handleClose() {
    setQuantity(1);
    createPurchase.reset();
    createBulkOrder.reset();
    onClose();
  }

  if (!open || !listing) return null;

  const isOutOfStock = (listing.stockQuantity ?? 0) <= 0;
  const effectiveQuantity = isQuick ? 1 : quantity;
  const cost = (listing.pricePerUnit ?? 0) * effectiveQuantity;
  const errorMessage =
    mutation.error instanceof ApiRequestError
      ? mutation.error.message
      : mutation.error
        ? "Something went wrong."
        : null;

  function handleSubmit() {
    if (!listing) return;
    mutation.mutate({ listingId: listing.id, quantity: effectiveQuantity });
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[440px]">
      {mutation.isSuccess ? (
        <div className="flex flex-col items-center text-center gap-3 py-4 pr-4">
          <span className="h-12 w-12 rounded-full bg-user-teal-start/15 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-user-teal-end" />
          </span>
          <h3 className="font-semibold text-body-text text-lg">
            {isQuick ? "Purchase Complete" : "Order Submitted"}
          </h3>
          <p className="text-sm text-muted-text">
            {isQuick
              ? `You bought ${effectiveQuantity} unit${effectiveQuantity === 1 ? "" : "s"} of ${listing.name}. ${cost} credits were charged.`
              : `Your request for ${listing.name} is pending approval. ${cost} credits will be charged once the supplier fulfills it.`}
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
              {isQuick
                ? "Confirm your purchase."
                : isOutOfStock
                  ? "This item is currently out of stock. Submitting still places your order — the supplier will fulfill it once restocked."
                  : "Choose a quantity to submit your order."}
            </p>
          </div>

          {isQuick ? (
            <div className="border-t border-border/40 pt-4">
              <p className="text-muted-text text-xs">Quantity</p>
              <p className="text-body-text font-medium">1 unit</p>
              <p className="text-body-text font-medium mt-2">{cost} credits</p>
            </div>
          ) : (
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
          )}

          {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

          <Button
            type="button"
            className={`w-full ${mutation.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending ? "Submitting…" : isQuick ? "Confirm Purchase" : "Submit Order"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
