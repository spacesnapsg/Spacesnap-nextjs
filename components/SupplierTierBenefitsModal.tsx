"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

// 2026-07-22 (Sprint 6.10, supplier Financials page) — static marketing
// infographic, same idiom as TierBenefitsModal.tsx for the user-facing
// tiers: not data-bound. Company.supplierTier is still admin-set only (see
// Sprint 6.10's "Supplier Tier — Automatic Calculation" thread in
// SPRINT_PLAN_NEXTJS_REWRITE.md) — the thresholds shown in this image are
// the product owner's own asset, not yet confirmed/wired as a live
// calculation. Don't treat this image as evidence the automatic calculation
// is built; it isn't.
interface SupplierTierBenefitsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SupplierTierBenefitsModal({ open, onClose }: SupplierTierBenefitsModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[1260px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Supplier Tiers</h2>
      <p className="text-sm text-muted-text mb-6">
        Free, Preferred, and Top tiers unlock increasing purchased-credit rebates and faster payout
        cycles as your rating and spend grow.
      </p>

      <img
        src="/rewards/supplier-reward-tiers-infographic.png"
        alt="SpaceSnap Rewards — Loyalty Tiers for suppliers. Free Tier: 1% rebate on purchased credit spend, monthly payout cycles, everyone starts here. Preferred Tier: 4.0 average rating and 50,000 credits spend, 1.2% rebate, fortnightly payout cycle. Top Tier: 4.5 average rating and 100,000 credits spend, 1.5% rebate, weekly payout cycle. Spend measured on a rolling 3-month window. Referral Bonus: earn 2000 credits when a referred friend books 3000+ credits, adds to your spend threshold for the next tier, rebates paid as Earned Credits."
        className="w-full rounded-card mb-6"
      />

      <Button type="button" onClick={onClose} className="w-full !bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end">
        Close
      </Button>
    </Modal>
  );
}
