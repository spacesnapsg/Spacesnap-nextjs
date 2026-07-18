"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { MOCK_CREDIT_PACKAGES } from "@/lib/mockWallet";

interface TopUpCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TopUpCreditsModal({ open, onClose }: TopUpCreditsModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[480px]">
      <div className="flex flex-col gap-5 pr-4">
        <h3 className="font-semibold text-body-text text-lg leading-snug">Top Up Credits</h3>

        <div className="flex flex-col gap-3">
          {MOCK_CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedId(pkg.id)}
              className={`flex items-center justify-between rounded border px-4 py-3.5 text-left transition-colors ${
                selectedId === pkg.id
                  ? "bg-user-teal-start/10 border-user-teal-start"
                  : "bg-background border-border hover:border-user-teal-start/50"
              }`}
            >
              <span className="text-body-text font-medium">{pkg.credits} Credits</span>
              <span className="text-muted-text">${pkg.price}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-text">Or enter a custom amount</label>
          <Input type="number" min="0" placeholder="e.g. 150" />
        </div>

        <Button
          type="button"
          disabled={!selectedId}
          className={`w-full ${!selectedId ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Confirm Purchase
        </Button>
      </div>
    </Modal>
  );
}
