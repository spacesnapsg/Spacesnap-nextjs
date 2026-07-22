"use client";

import { useState } from "react";
import { ChevronDown, FileBarChart2, Megaphone, Crown, Ticket as VoucherIcon } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import {
  useSupplierRewardsCatalogue,
  useMySupplierRewardRedemptions,
  useRedeemSupplierReward,
} from "@/lib/hooks/useSupplierRewardsCatalogue";
import type { SupplierRewardRedemptionStatus } from "@/lib/hooks/useSupplierRewardsCatalogue";
import type { SupplierRewardCatalogueItem, SupplierRewardCategory } from "@/lib/hooks/useAdminSupplierRewards";
import { ApiRequestError } from "@/lib/api-client";

// Real catalogue + redemption flow (Sprint 6.10) — the company-scoped
// mirror of RewardsCatalogueModal.tsx. Replaces the old hardcoded
// PLACEHOLDER_REWARDS array and its disabled "Coming Soon" buttons: see
// GET /api/supplier/rewards, POST /api/supplier/rewards/[id]/redeem,
// GET /api/supplier/rewards/redemptions, lib/supplier-reward-redemptions.ts.
// No partner-picker step here (unlike the user-facing pitch_ticket/
// consultancy categories) — report/ad items have no partnerOptions
// equivalent, they just start `pending` for the admin the instant they're
// redeemed.
const CATEGORY_ICONS: Record<SupplierRewardCategory, typeof FileBarChart2> = {
  report: FileBarChart2,
  ad: Megaphone,
  system: Crown,
};

const CATEGORY_LABELS: Record<SupplierRewardCategory, string> = {
  report: "Report",
  ad: "Ad",
  system: "System",
};

const TARGET_GROUP_LABELS: Record<string, string> = {
  bookings: "Bookings",
  equipment: "Equipment",
  consumables: "Consumables",
};

const STATUS_BADGE_STYLES: Record<SupplierRewardRedemptionStatus, string> = {
  pending: "text-amber bg-amber/15 border-amber/30",
  used: "text-supplier-purple-end bg-supplier-purple-end/10 border-supplier-purple-end/20",
  cancelled: "text-error-red bg-error-red/10 border-error-red/20",
};

const STATUS_LABELS: Record<SupplierRewardRedemptionStatus, string> = {
  pending: "Pending",
  used: "Used",
  cancelled: "Cancelled",
};

function rewardDetailLine(item: SupplierRewardCatalogueItem): string | null {
  switch (item.category) {
    case "report":
      return item.reportTargetGroups.length > 0
        ? `Covers: ${item.reportTargetGroups.map((g) => TARGET_GROUP_LABELS[g] ?? g).join(", ")}`
        : "Platform-wide";
    case "ad":
      return item.campaignDurationDays ? `${item.campaignDurationDays}-day placement` : null;
    case "system":
      return item.upgradeDurationMonths ? `${item.upgradeDurationMonths} month tier boost` : null;
  }
}

interface SupplierRewardsCatalogueModalProps {
  open: boolean;
  onClose: () => void;
  earnedCredits: number;
}

export default function SupplierRewardsCatalogueModal({
  open,
  onClose,
  earnedCredits,
}: SupplierRewardsCatalogueModalProps) {
  const [showRedeemed, setShowRedeemed] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const { data: rewards, isLoading, isError } = useSupplierRewardsCatalogue();
  const { data: redemptions } = useMySupplierRewardRedemptions();
  const redeem = useRedeemSupplierReward();

  function handleRedeemClick(reward: SupplierRewardCatalogueItem) {
    setRedeemError(null);
    redeem.mutate(
      { itemId: reward.id },
      { onError: (error) => setRedeemError(error instanceof ApiRequestError ? error.message : "Something went wrong.") }
    );
  }

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-4xl">
      <div className="-m-8 mb-0 rounded-t-card bg-gradient-to-r from-supplier-purple-start via-supplier-purple-end to-user-teal-start p-8">
        <span className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
          <Crown size={18} className="text-white" />
        </span>
        <p className="text-white/80 text-sm">Your Earned Credits</p>
        <p className="text-white text-3xl font-extrabold">{earnedCredits} Credits</p>
      </div>

      <div className="pt-6">
        <button
          type="button"
          onClick={() => setShowRedeemed((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-medium text-supplier-purple-end hover:text-user-teal-start transition-colors"
        >
          View redeemed rewards
          <ChevronDown size={16} className={`transition-transform ${showRedeemed ? "rotate-180" : ""}`} />
        </button>

        {showRedeemed && (
          <div className="mt-3 flex flex-col gap-2">
            {!redemptions || redemptions.length === 0 ? (
              <p className="text-sm text-muted-text py-2">No rewards redeemed yet.</p>
            ) : (
              redemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="flex items-center justify-between rounded border border-border/40 px-4 py-3 gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VoucherIcon size={16} className="text-supplier-purple-end shrink-0" />
                    <span className="text-sm text-body-text truncate block">{redemption.itemName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 border ${STATUS_BADGE_STYLES[redemption.status]}`}
                    >
                      {STATUS_LABELS[redemption.status]}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-text bg-white/5 rounded-full px-2 py-0.5">
                      {redemption.creditCost} credits
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="pt-6">
        <h3 className="text-lg font-semibold text-body-text mb-1">Supplier Rewards Catalogue</h3>
        <p className="text-sm text-muted-text mb-4">Spend earned credits on reports, ad placements, and tier boosts.</p>

        {redeemError && <p className="text-sm text-error-red mb-4">{redeemError}</p>}

        {isLoading ? (
          <p className="text-sm text-muted-text text-center py-8">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-error-red text-center py-8">Failed to load the rewards catalogue.</p>
        ) : !rewards || rewards.length === 0 ? (
          <p className="text-sm text-muted-text text-center py-8">No rewards available right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => {
              const Icon = CATEGORY_ICONS[reward.category];
              const detail = rewardDetailLine(reward);
              const canAfford = earnedCredits >= reward.creditCost;
              const isRedeeming = redeem.isPending && redeem.variables?.itemId === reward.id;
              const redeemDisabled = reward.fullyRedeemed || !canAfford || redeem.isPending;
              return (
                <div
                  key={reward.id}
                  className={`relative rounded-card border overflow-hidden flex flex-col transition-colors ${
                    reward.fullyRedeemed ? "border-border/40 opacity-60" : "border-border/40 hover:border-supplier-purple-end/50"
                  }`}
                >
                  {reward.fullyRedeemed && (
                    <span className="absolute top-2 right-2 z-10 text-[10px] font-medium uppercase tracking-wide text-amber bg-amber/15 border border-amber/30 rounded-full px-2 py-0.5">
                      Fully Redeemed
                    </span>
                  )}
                  <div className="h-24 bg-gradient-to-br from-supplier-purple-start/20 to-user-teal-start/20 flex items-center justify-center">
                    <span className="h-12 w-12 rounded-full bg-gradient-to-br from-supplier-purple-start to-user-teal-start flex items-center justify-center">
                      <Icon size={22} className="text-white" />
                    </span>
                  </div>
                  <div className="p-4 flex flex-col gap-1 flex-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-supplier-purple-end">
                      {CATEGORY_LABELS[reward.category]}
                    </span>
                    <p className="text-sm font-semibold text-body-text">{reward.name}</p>
                    <p className="text-xs text-muted-text leading-snug">{reward.description}</p>
                    {detail && <p className="text-xs text-supplier-purple-end font-medium mt-1">{detail}</p>}
                    <p className="text-xs font-medium text-body-text mt-2">{reward.creditCost} credits</p>
                    {!reward.fullyRedeemed && (
                      <Button
                        type="button"
                        variant={canAfford ? "primary" : "ghost"}
                        disabled={redeemDisabled}
                        onClick={() => handleRedeemClick(reward)}
                        className={`h-9 w-full text-xs mt-3 ${redeemDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isRedeeming ? "Redeeming…" : canAfford ? "Redeem" : "Not enough credits"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
