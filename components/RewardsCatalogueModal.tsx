"use client";

import { useState } from "react";
import { Gift, ChevronDown, Percent, Users, Scale, PartyPopper, Ticket, Crown, Package, Ticket as VoucherIcon } from "lucide-react";
import Modal from "@/components/Modal";
import { useRewardsCatalogue } from "@/lib/hooks/useRewardsCatalogue";
import type { RewardCatalogueItem, RewardCategory, RewardDiscountAppliesTo } from "@/lib/hooks/useAdminRewards";

// 2026-07-22 (Sprint 6.9): the catalogue grid below is real and
// admin-manageable — see components/AdminRewards.tsx (Sprint 6.7/6.8/6.9) and
// GET /api/rewards. Only the "View redeemed rewards" list underneath is
// still placeholder: no GET endpoint exists yet for a user's own RewardGrant
// rows (only server-side redemption logic exists, lib/reward-grants.ts) —
// that remains a separate, still-open item per the sprint plan.
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
  certification_fee: "Certification Fee",
};

function rewardDetailLine(item: RewardCatalogueItem): string | null {
  switch (item.category) {
    case "discount":
      return `${item.discountPercent ?? 0}% off${
        item.discountAppliesTo.length > 0 ? ` · ${item.discountAppliesTo.map((a) => APPLIES_TO_LABELS[a]).join(", ")}` : ""
      }`;
    case "pitch_ticket":
      return item.partnerName ? `Partner: ${item.partnerName}` : null;
    case "consultancy":
      return [item.consultancySubject, item.partnerName ? `Partner: ${item.partnerName}` : null].filter(Boolean).join(" · ") || null;
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

interface ActiveVoucher {
  id: string;
  name: string;
  status: string;
}

const PLACEHOLDER_ACTIVE_VOUCHERS: ActiveVoucher[] = [
  { id: "sample-1", name: "Discount Voucher — 10% off", status: "Unused" },
  { id: "sample-2", name: "Consumable Redemption", status: "Unused" },
];

interface RewardsCatalogueModalProps {
  open: boolean;
  onClose: () => void;
  earnedCredits: number;
}

export default function RewardsCatalogueModal({ open, onClose, earnedCredits }: RewardsCatalogueModalProps) {
  const [showActiveVouchers, setShowActiveVouchers] = useState(false);
  const { data: rewards, isLoading, isError } = useRewardsCatalogue();

  return (
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
            {PLACEHOLDER_ACTIVE_VOUCHERS.length === 0 ? (
              <p className="text-sm text-muted-text py-2">No active vouchers or tickets yet.</p>
            ) : (
              PLACEHOLDER_ACTIVE_VOUCHERS.map((voucher) => (
                <div
                  key={voucher.id}
                  className="flex items-center justify-between rounded border border-border/40 px-4 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VoucherIcon size={16} className="text-user-teal-end shrink-0" />
                    <span className="text-sm text-body-text truncate">{voucher.name}</span>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-user-teal-end bg-user-teal-end/10 rounded-full px-2 py-0.5">
                    {voucher.status}
                  </span>
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
                  <div className="p-4 flex flex-col gap-1">
                    <p className="text-sm font-semibold text-body-text">{reward.name}</p>
                    <p className="text-xs text-muted-text leading-snug">{reward.description}</p>
                    {detail && <p className="text-xs text-user-teal-end font-medium mt-1">{detail}</p>}
                    <p className="text-xs font-medium text-body-text mt-2">{reward.creditCost} credits</p>
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
