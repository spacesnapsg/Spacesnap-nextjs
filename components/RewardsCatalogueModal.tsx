"use client";

import { useState } from "react";
import {
  Gift,
  ChevronDown,
  Percent,
  Users,
  Scale,
  PartyPopper,
  Ticket,
  Crown,
  Package,
  Ticket as VoucherIcon,
} from "lucide-react";
import Modal from "@/components/Modal";

// 2026-07-22, Sprint 6.6: rewards catalogue is placeholder-only — none of
// these are backed by a real RewardGrant issuance flow yet (that model/
// redemption logic exists, lib/reward-grants.ts, but nothing ever creates
// one for a user to redeem here). Same for the "active vouchers" list below.
// Wiring both to real data + an admin activate/deactivate toggle is Sprint
// 6.7; per-reward value customization (% off, consumable value) is Sprint
// 6.8. Do not treat the arrays below as real inventory.
interface CatalogueReward {
  id: string;
  name: string;
  description: string;
  icon: typeof Percent;
}

const CATALOGUE_REWARDS: CatalogueReward[] = [
  {
    id: "discount_voucher",
    name: "Discount Voucher",
    description: "Offsets a percentage of your booking fee for spaces and equipment.",
    icon: Percent,
  },
  {
    id: "vc_pitch_ticket",
    name: "VC Pitch Ticket",
    description: "A 1-hour session with a partner VC to pitch your startup.",
    icon: Users,
  },
  {
    id: "legal_consultancy",
    name: "Legal Consultancy",
    description: "A 1-hour session with a partner legal firm.",
    icon: Scale,
  },
  {
    id: "exclusive_event_invite",
    name: "Exclusive Event Invite",
    description: "Entry to an event organized by SpaceSnap or its affiliates.",
    icon: PartyPopper,
  },
  {
    id: "lucky_draw_ticket",
    name: "Lucky Draw Ticket",
    description: "A chance in a lucky draw for various prizes (TBC).",
    icon: Ticket,
  },
  {
    id: "premium_tier_upgrade",
    name: "Premium Tier Upgrade",
    description: "Upgrades you to the next membership tier for 3 months.",
    icon: Crown,
  },
  {
    id: "consumable_redemption",
    name: "Consumable Redemption",
    description: "A consumable redemption at the consumables kiosk.",
    icon: Package,
  },
];

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATALOGUE_REWARDS.map((reward) => {
            const Icon = reward.icon;
            return (
              <div
                key={reward.id}
                className="rounded-card border border-border/40 overflow-hidden flex flex-col hover:border-user-teal-end/50 transition-colors"
              >
                <div className="h-24 bg-gradient-to-br from-user-teal-start/20 to-supplier-purple-start/20 flex items-center justify-center">
                  <span className="h-12 w-12 rounded-full bg-gradient-to-br from-user-teal-start to-supplier-purple-start flex items-center justify-center">
                    <Icon size={22} className="text-white" />
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <p className="text-sm font-semibold text-body-text">{reward.name}</p>
                  <p className="text-xs text-muted-text leading-snug">{reward.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
