"use client";

import { useState } from "react";
import { Gift, ChevronDown, Percent, Users, Scale, PartyPopper, Ticket, Crown, Package, Ticket as VoucherIcon } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useRewardsCatalogue, useMyRewardRedemptions, useRedeemReward } from "@/lib/hooks/useRewardsCatalogue";
import type { RewardRedemptionStatus } from "@/lib/hooks/useRewardsCatalogue";
import type { RewardCatalogueItem, RewardCategory, RewardDiscountAppliesTo } from "@/lib/hooks/useAdminRewards";
import { ApiRequestError } from "@/lib/api-client";

// 2026-07-22 (Sprint 6.9): the catalogue grid below is real and
// admin-manageable — see components/AdminRewards.tsx (Sprint 6.7/6.8/6.9) and
// GET /api/rewards. The "View redeemed rewards" list and the Redeem button
// itself (both 2026-07-22, same day) are now real too — POST
// /api/rewards/[id]/redeem + GET /api/rewards/redemptions, see
// lib/reward-redemptions.ts.
//
// Same-day follow-up (fulfillment session): pitch_ticket/consultancy now
// require picking a partner before redeeming (PartnerPickerModal below), and
// every redemption carries a real fulfillment status badge instead of just
// a flat credit-cost pill.
const CATEGORY_ICONS: Record<RewardCategory, typeof Percent> = {
  discount: Percent,
  pitch_ticket: Users,
  consultancy: Scale,
  events: PartyPopper,
  lucky_draw: Ticket,
  tier_upgrade: Crown,
  consumable: Package,
};

const APPLIES_TO_LABELS: Record<RewardDiscountAppliesTo, string> = {
  booking: "Booking",
  equipment: "Equipment",
};

const STATUS_BADGE_STYLES: Record<RewardRedemptionStatus, string> = {
  pending: "text-amber bg-amber/15 border-amber/30",
  used: "text-user-teal-end bg-user-teal-end/10 border-user-teal-end/20",
  cancelled: "text-error-red bg-error-red/10 border-error-red/20",
};

const STATUS_LABELS: Record<RewardRedemptionStatus, string> = {
  pending: "Pending",
  used: "Used",
  cancelled: "Cancelled",
};

function rewardDetailLine(item: RewardCatalogueItem): string | null {
  switch (item.category) {
    case "discount":
      return `${item.discountPercent ?? 0}% off${
        item.discountAppliesTo.length > 0 ? ` · ${item.discountAppliesTo.map((a) => APPLIES_TO_LABELS[a]).join(", ")}` : ""
      }`;
    case "pitch_ticket":
      return item.partnerOptions.length > 0 ? `Partners: ${item.partnerOptions.join(", ")}` : null;
    case "consultancy":
      return (
        [item.consultancySubject, item.partnerOptions.length > 0 ? `Partners: ${item.partnerOptions.join(", ")}` : null]
          .filter(Boolean)
          .join(" · ") || null
      );
    case "events":
      return [item.eventName, item.eventInfo].filter(Boolean).join(" · ") || null;
    case "lucky_draw":
      return item.prizeDescription ? `${item.prizeDescription} × ${item.prizeQuantity ?? 1}` : null;
    case "tier_upgrade":
      return item.upgradeDurationMonths ? `${item.upgradeDurationMonths} month upgrade` : null;
    case "consumable":
      return item.consumableName ? `${item.consumableName} × ${item.consumableQuantity ?? 1}` : null;
  }
}

// pitch_ticket/consultancy only — a user must pick which partner they want
// before the redemption fires (confirmed with the product owner: a single
// catalogue item can now list several partners). A small dedicated modal
// rather than an inline dropdown on the card, since the grid is already
// dense.
function PartnerPickerModal({
  item,
  onCancel,
  onConfirm,
  isSubmitting,
  error,
}: {
  item: RewardCatalogueItem | null;
  onCancel: () => void;
  onConfirm: (partner: string) => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<string>(item?.partnerOptions[0] ?? "");

  const resetKey = item?.id ?? "closed";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setSelected(item?.partnerOptions[0] ?? "");
  }

  return (
    <Modal open={!!item} onClose={onCancel} className="w-full max-w-[420px]">
      <h2 className="text-lg font-semibold text-body-text mb-1">{item?.name}</h2>
      <p className="text-sm text-muted-text mb-4">Choose a partner — the admin will reach out to arrange it.</p>

      {item && item.partnerOptions.length > 0 ? (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-user-teal-start transition-colors w-full"
        >
          {item.partnerOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-error-red">No partners are configured for this reward yet.</p>
      )}

      {error && <p className="text-sm text-error-red mt-3">{error}</p>}

      <Button
        type="button"
        disabled={isSubmitting || !selected}
        onClick={() => selected && onConfirm(selected)}
        className={`w-full mt-4 ${isSubmitting || !selected ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isSubmitting ? "Redeeming…" : "Confirm"}
      </Button>
    </Modal>
  );
}

interface RewardsCatalogueModalProps {
  open: boolean;
  onClose: () => void;
  earnedCredits: number;
}

export default function RewardsCatalogueModal({ open, onClose, earnedCredits }: RewardsCatalogueModalProps) {
  const [showActiveVouchers, setShowActiveVouchers] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [partnerPickerItem, setPartnerPickerItem] = useState<RewardCatalogueItem | null>(null);
  const { data: rewards, isLoading, isError } = useRewardsCatalogue();
  const { data: redemptions } = useMyRewardRedemptions();
  const redeem = useRedeemReward();

  function handleRedeemClick(reward: RewardCatalogueItem) {
    setRedeemError(null);
    if (reward.category === "pitch_ticket" || reward.category === "consultancy") {
      setPartnerPickerItem(reward);
      return;
    }
    redeem.mutate(
      { itemId: reward.id },
      { onError: (error) => setRedeemError(error instanceof ApiRequestError ? error.message : "Something went wrong.") }
    );
  }

  function handleConfirmPartner(partner: string) {
    if (!partnerPickerItem) return;
    redeem.mutate(
      { itemId: partnerPickerItem.id, selectedPartnerOption: partner },
      {
        onSuccess: () => setPartnerPickerItem(null),
        onError: (error) => setRedeemError(error instanceof ApiRequestError ? error.message : "Something went wrong."),
      }
    );
  }

  return (
    <>
    <Modal open={open} onClose={onClose} className="w-full max-w-4xl">
      <div className="-m-8 mb-0 rounded-t-card bg-gradient-to-r from-user-teal-start via-user-teal-end to-supplier-purple-start p-8">
        <span className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
          <Gift size={18} className="text-white" />
        </span>
        <p className="text-white/80 text-sm">Your Earned Credits</p>
        <p className="text-white text-3xl font-extrabold">{earnedCredits} Credits</p>
      </div>

      <div className="pt-6">
        <button
          type="button"
          onClick={() => setShowActiveVouchers((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-medium text-user-teal-end hover:text-supplier-purple-start transition-colors"
        >
          View redeemed rewards
          <ChevronDown size={16} className={`transition-transform ${showActiveVouchers ? "rotate-180" : ""}`} />
        </button>

        {showActiveVouchers && (
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
                    <VoucherIcon size={16} className="text-user-teal-end shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-body-text truncate block">{redemption.itemName}</span>
                      {redemption.selectedPartnerOption && (
                        <span className="text-xs text-muted-text truncate block">Partner: {redemption.selectedPartnerOption}</span>
                      )}
                    </div>
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
        <h3 className="text-lg font-semibold text-body-text mb-1">Rewards Catalogue</h3>
        <p className="text-sm text-muted-text mb-4">
          Redeem your earned credits for these rewards. More details coming soon.
        </p>

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
                    reward.fullyRedeemed ? "border-border/40 opacity-60" : "border-border/40 hover:border-user-teal-end/50"
                  }`}
                >
                  {reward.fullyRedeemed && (
                    <span className="absolute top-2 right-2 z-10 text-[10px] font-medium uppercase tracking-wide text-amber bg-amber/15 border border-amber/30 rounded-full px-2 py-0.5">
                      Fully Redeemed
                    </span>
                  )}
                  <div className="h-24 bg-gradient-to-br from-user-teal-start/20 to-supplier-purple-start/20 flex items-center justify-center">
                    <span className="h-12 w-12 rounded-full bg-gradient-to-br from-user-teal-start to-supplier-purple-start flex items-center justify-center">
                      <Icon size={22} className="text-white" />
                    </span>
                  </div>
                  <div className="p-4 flex flex-col gap-1 flex-1">
                    <p className="text-sm font-semibold text-body-text">{reward.name}</p>
                    <p className="text-xs text-muted-text leading-snug">{reward.description}</p>
                    {detail && <p className="text-xs text-user-teal-end font-medium mt-1">{detail}</p>}
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

      <PartnerPickerModal
        item={partnerPickerItem}
        onCancel={() => setPartnerPickerItem(null)}
        onConfirm={handleConfirmPartner}
        isSubmitting={redeem.isPending && redeem.variables?.itemId === partnerPickerItem?.id}
        error={redeemError}
      />
    </>
  );
}
