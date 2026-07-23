"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

// 2026-07-23 — the product owner replaced the supplier tier criteria
// (bookings/cancellation-rate/spend, see lib/supplier-tiers.ts) and dropped
// in a matching updated infographic (public/rewards/
// supplier-reward-tiers-infographic.png) the same day, so this stays the
// same static-image idiom as TierBenefitsModal.tsx (user-facing tiers) —
// briefly swapped to a text-rendered table when only the old, stale-numbers
// asset existed, reverted once the real replacement landed. The image is
// also the source of truth this session used to correct
// lib/company-credits.ts's COMPANY_REBATE_PERCENT (1%/1.2%/1.5%, previously
// an unconfirmed 1%/1.5%/2% guess) — don't let that constant drift from
// this image again without updating both together.
interface SupplierTierBenefitsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SupplierTierBenefitsModal({ open, onClose }: SupplierTierBenefitsModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[1260px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Supplier Tiers</h2>
      <p className="text-sm text-muted-text mb-6">
        Free, Preferred, and Top tiers unlock increasing purchased-credit rebates and other perks as
        your booking volume, reliability, and spend grow.
      </p>

      <img
        src="/rewards/supplier-reward-tiers-infographic.png"
        alt="SpaceSnap Rewards — Loyalty Tiers for suppliers. Free Tier: 1% rebate on purchased credit spend, 3 free Bumps a month, everyone starts here. Preferred Tier: min 50 bookings, under 10% cancellation rate, and 50,000 credits spend, 1.2% rebate, 5 free Bumps and 1 free Pin a month. Top Tier: min 100 bookings, under 3% cancellation rate, and 100,000 credits spend, 1.5% rebate, 7 free Bumps and 2 free Pins a month. Spend measured on a rolling 3-month window. Referral Bonus: earn 2000 credits when a referred friend books 3000+ credits, adds to your spend threshold for the next tier, rebates paid as Earned Credits."
        className="w-full rounded-card mb-6"
      />

      <Button type="button" onClick={onClose} className="w-full !bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end">
        Close
      </Button>
    </Modal>
  );
}
