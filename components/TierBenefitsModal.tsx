"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

// 2026-07-21: real infographic dropped in by the product owner (Canva
// export, moved from the repo root's "Campaign Assets/" into
// public/rewards/ under a clean filename). This modal is the static benefits
// reference — the actual tier assignment/progress/referral system is now
// live (Sprint 6.5, closed 2026-07-21/22), surfaced on the user dashboard's
// "User Tier" card (app/(user)/user/page.tsx) via GET /api/me's
// `rewardTier`/`referralCode` fields (lib/reward-tiers.ts). This infographic
// intentionally stays static — it's marketing copy, not a data-bound view.

interface TierBenefitsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TierBenefitsModal({ open, onClose }: TierBenefitsModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[1260px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Reward Tiers</h2>
      <p className="text-sm text-muted-text mb-6">
        Free, Starter, Growth, and Power tiers unlock increasing earned-credit rebates as you book and
        spend more.
      </p>

      <img
        src="/rewards/reward-tiers-infographic.png"
        alt="SpaceSnap Rewards — Loyalty Tiers. Free: 1% earned rebate, everyone starts here. Starter: 8 bookings and $1,000 spend, 1.2% rebate. Growth: 20 bookings and $2,500 spend, 1.5% rebate. Power: 35 bookings and $4,500 spend, 1.8% rebate. Referral Bonus: earn $200 when a referred friend books $300+, reduces your spend threshold for the next tier, rebates paid as Earned Credits."
        className="w-full rounded-card mb-6"
      />

      <Button type="button" onClick={onClose} className="w-full">
        Close
      </Button>
    </Modal>
  );
}
