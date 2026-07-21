"use client";

import { Trophy, Lock } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";

// Placeholder only — Sprint 6.5 (Rewards/Tier System) hasn't started. No
// tier thresholds, spend windows, or per-tier benefits are confirmed with
// the product owner yet (see SPRINT_PLAN_NEXTJS_REWRITE.md, "Sprint 6.5:
// Rewards/Tier System — Not Started"). Tier names (Free/Starter/Growth/
// Power) are the only thing already decided; everything else here is a
// stand-in to be replaced once real numbers land.
const PLACEHOLDER_TIERS = [
  { name: "Free", blurb: "Every member starts here." },
  { name: "Starter", blurb: "Unlocks once booking/spend criteria are confirmed." },
  { name: "Growth", blurb: "Unlocks once booking/spend criteria are confirmed." },
  { name: "Power", blurb: "Unlocks once booking/spend criteria are confirmed." },
];

interface TierBenefitsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TierBenefitsModal({ open, onClose }: TierBenefitsModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Reward Tiers</h2>
      <p className="text-sm text-muted-text mb-6">
        Free, Starter, Growth, and Power tiers unlock increasing rewards as you book and engage more.
        Exact thresholds and benefits are still being finalized.
      </p>

      <div className="rounded border border-dashed border-border/60 bg-background/60 flex flex-col items-center justify-center gap-3 py-12 px-6 text-center mb-6">
        <span className="h-12 w-12 rounded-full bg-user-teal-start/15 text-user-teal-end flex items-center justify-center">
          <Trophy size={22} />
        </span>
        <p className="text-sm text-muted-text max-w-sm">
          Tier benefits infographic placeholder — to be replaced with the real graphic once tier
          thresholds and rewards are confirmed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {PLACEHOLDER_TIERS.map((tier) => (
          <div key={tier.name} className="rounded border border-border/40 p-3 flex items-start gap-2">
            <Lock size={14} className="text-hint-text mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-body-text">{tier.name}</p>
              <p className="text-xs text-muted-text">{tier.blurb}</p>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" onClick={onClose} className="w-full">
        Close
      </Button>
    </Modal>
  );
}
