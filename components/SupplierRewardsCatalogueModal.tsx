"use client";

import { FileBarChart2, Megaphone, Crown } from "lucide-react";
import Modal from "@/components/Modal";
import Card from "@/components/Card";

// 2026-07-22 (Sprint 6.10, supplier Financials page) — UI-only placeholder,
// deliberately not wired to any backend yet. There is no supplier-facing
// equivalent of RewardCatalogueItem/RewardRedemption in the schema — this
// component ships the visual design ahead of that decision, per the product
// owner's own "make the UI first" instruction for this session. See the
// Sprint 6.10 "Supplier Rewards Catalogue" section in
// SPRINT_PLAN_NEXTJS_REWRITE.md for what's still open before this can redeem
// anything for real.
type SupplierRewardCategory = "report" | "ad" | "system";

interface SupplierRewardCatalogueItem {
  id: string;
  name: string;
  category: SupplierRewardCategory;
  description: string;
  detail: string;
  creditCost: number;
}

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

// Placeholder credit costs — the product owner asked for "a random number
// first" for each, not yet priced against anything real.
const PLACEHOLDER_REWARDS: SupplierRewardCatalogueItem[] = [
  {
    id: "targeted-insights-report",
    name: "Targeted Insights Report",
    category: "report",
    description: "A statistics report on your chosen target group.",
    detail: "Target group: Bookings, Equipment, or Consumables",
    creditCost: 800,
  },
  {
    id: "platform-performance-report",
    name: "Platform Performance Report",
    category: "report",
    description: "Platform-wide analytics and performance benchmarks.",
    detail: "Covers all suppliers on SpaceSnap",
    creditCost: 1200,
  },
  {
    id: "popup-ad-campaign",
    name: "Popup Ad Campaign",
    category: "ad",
    description: "Run a week-long popup ad campaign for your listings.",
    detail: "7-day placement",
    creditCost: 400,
  },
  {
    id: "spotlight-listing",
    name: "Spotlight Listing",
    category: "ad",
    description: "Ensure your listing appears at the top of search results.",
    detail: "Priority placement in Discover/Marketplace",
    creditCost: 600,
  },
  {
    id: "tier-boost",
    name: "Tier Boost",
    category: "system",
    description: "Temporarily bump your supplier tier for a set duration.",
    detail: "Same mechanic as the user Tier Bump reward",
    creditCost: 1000,
  },
  {
    id: "newsletter-feature",
    name: "Newsletter Feature",
    category: "ad",
    description: "Be featured in our newsletter (EDM).",
    detail: "One feature slot per send",
    creditCost: 300,
  },
];

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
        <h3 className="text-lg font-semibold text-body-text mb-1">Supplier Rewards Catalogue</h3>
        <p className="text-sm text-muted-text mb-4">
          Spend earned credits on reports, ad placements, and tier boosts. Redemption isn&apos;t wired up
          yet — this is a preview of what&apos;s coming.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLACEHOLDER_REWARDS.map((reward) => {
            const Icon = CATEGORY_ICONS[reward.category];
            const canAfford = earnedCredits >= reward.creditCost;
            return (
              <Card key={reward.id} className="flex flex-col gap-2 !p-4">
                <div className="flex items-center justify-between">
                  <span className="h-10 w-10 rounded-full bg-gradient-to-br from-supplier-purple-start to-user-teal-start flex items-center justify-center">
                    <Icon size={18} className="text-white" />
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-supplier-purple-end bg-supplier-purple-start/10 rounded-full px-2 py-0.5">
                    {CATEGORY_LABELS[reward.category]}
                  </span>
                </div>
                <p className="text-sm font-semibold text-body-text mt-1">{reward.name}</p>
                <p className="text-xs text-muted-text leading-snug">{reward.description}</p>
                <p className="text-xs text-supplier-purple-end font-medium">{reward.detail}</p>
                <p className="text-xs font-medium text-body-text mt-1">{reward.creditCost} credits</p>
                <button
                  type="button"
                  disabled
                  className={`h-9 w-full rounded text-xs font-medium mt-2 cursor-not-allowed ${
                    canAfford
                      ? "bg-supplier-purple-start/15 text-supplier-purple-end"
                      : "bg-border/20 text-muted-text"
                  }`}
                >
                  Coming Soon
                </button>
              </Card>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
