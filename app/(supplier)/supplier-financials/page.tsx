"use client";

import { useMemo, useState } from "react";
import { Trophy, Wallet, Gift, Landmark } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/components/Card";
import SupplierRewardsCatalogueModal from "@/components/SupplierRewardsCatalogueModal";
import SupplierTierBenefitsModal from "@/components/SupplierTierBenefitsModal";
import CompanyTopUpModal from "@/components/CompanyTopUpModal";
import { useSupplierCompany, type SupplierTier } from "@/lib/hooks/useSupplierCompany";
import { useSupplierRevenueByType } from "@/lib/hooks/useSupplierRevenue";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

const TIER_LABELS: Record<SupplierTier, string> = {
  free: "Free",
  preferred: "Preferred",
  top: "Top",
};

const CADENCE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  biweekly: "Biweekly",
  weekly: "Weekly",
};

// Requirement copy matches the real thresholds in lib/supplier-tiers.ts
// (confirmed correct against the infographic by the product owner,
// 2026-07-22) — the label/requirement text is static since the thresholds
// themselves are constants, but progressPercent below comes from the live
// GET /api/supplier/company response (company.tierStats), not a placeholder.
const NEXT_TIER: Record<SupplierTier, { label: string; requirement: string } | null> = {
  free: { label: "Preferred", requirement: "4.0★ rating & 50,000 credits spend" },
  preferred: { label: "Top", requirement: "4.5★ rating & 100,000 credits spend" },
  top: null,
};

function Pills<T extends string>({
  options,
  labels,
  active,
  onChange,
}: {
  options: T[];
  labels: Record<T, string>;
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
            active === option
              ? "bg-supplier-purple-start/15 border-supplier-purple-start text-supplier-purple-end"
              : "bg-card border-border text-muted-text hover:text-body-text"
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

function SupplierTierCard() {
  const { data: company, isLoading } = useSupplierCompany();
  const { data: user } = useCurrentUser();
  const [referralCopied, setReferralCopied] = useState(false);
  const [tierModalOpen, setTierModalOpen] = useState(false);

  const nextTier = company ? NEXT_TIER[company.supplierTier] : null;
  const progressPercent = company?.tierStats.progressPercent ?? 0;

  return (
    <Card className="flex flex-col gap-4 h-full">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-supplier-purple-start to-supplier-purple-end flex items-center justify-center">
        <Trophy size={20} className="text-white" />
      </div>
      <div>
        <p className="text-muted-text text-sm">Supplier Tier</p>
        <p className="text-2xl font-semibold text-body-text mt-1">
          {isLoading || !company ? "…" : TIER_LABELS[company.supplierTier]}
        </p>
        {company && (
          <p className="text-xs text-muted-text mt-1">{CADENCE_LABELS[company.invoicingCadence]} invoicing</p>
        )}
        {company?.tierStats.tierBoostActive && (
          <p className="text-xs text-supplier-purple-end mt-1">
            Boosted from {TIER_LABELS[company.tierStats.baseTier]} by a Tier Boost, active until{" "}
            {new Date(company.tierStats.tierBoostExpiresAt!).toLocaleDateString()}
          </p>
        )}
        {company && nextTier && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-text mb-1">
              <span>Progress to {nextTier.label}</span>
              <span>{nextTier.requirement}</span>
            </div>
            <div className="h-2 rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-supplier-purple-start to-user-teal-start"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setTierModalOpen(true)}
          className="text-xs text-supplier-purple-end hover:underline mt-3 inline-block"
        >
          View Tier Benefits
        </button>
        {user && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <p className="text-xs text-muted-text mb-1">Your referral code</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-body-text bg-border/20 rounded px-2 py-1">
                {user.referralCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(user.referralCode);
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                }}
                className="text-xs text-supplier-purple-end hover:underline"
              >
                {referralCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      <SupplierTierBenefitsModal open={tierModalOpen} onClose={() => setTierModalOpen(false)} />
    </Card>
  );
}

type RevenueRange = "3m" | "6m" | "12m";

const REVENUE_RANGE_LABELS: Record<RevenueRange, string> = {
  "3m": "3 Months",
  "6m": "6 Months",
  "12m": "12 Months",
};

// "YYYY-MM" -> short month label ("2026-08" -> "Aug") for the chart's X axis.
// Uses UTC so the label matches the month the server bucketed by, regardless
// of the viewer's timezone.
function shortMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

interface RevenueTooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: RevenueTooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const sum = payload.reduce((acc, entry) => acc + entry.value, 0);

  return (
    <div className="rounded-lg border border-border bg-[#151a23] px-3 py-2 text-xs">
      <p className="text-body-text font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value} credits
        </p>
      ))}
      <p className="text-body-text font-semibold mt-1 pt-1 border-t border-border/40">
        Total: {sum} credits
      </p>
    </div>
  );
}

function PlatformRevenueCard() {
  const [range, setRange] = useState<RevenueRange>("12m");
  const monthCount = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const { data: months, isLoading, isError } = useSupplierRevenueByType(monthCount);
  const data = useMemo(
    () => (months ?? []).map((m) => ({ ...m, label: shortMonthLabel(m.month) })),
    [months]
  );

  return (
    <Card className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-body-text">Platform Revenue</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Your revenue by listing type, per month.
          </p>
        </div>
        <Pills options={["3m", "6m", "12m"]} labels={REVENUE_RANGE_LABELS} active={range} onChange={setRange} />
      </div>

      <div className="h-72">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-text">Loading…</div>
        ) : isError ? (
          <div className="h-full flex items-center justify-center text-sm text-error-red">Failed to load revenue.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#ffffff", opacity: 0.06 }} />
              <Bar dataKey="space" name="Space" fill="#9333ea" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="equipment" name="Equipment" fill="#1a9d96" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="consumable" name="Consumables" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mt-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#9333ea" }} /> Space
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#1a9d96" }} /> Equipment
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b" }} /> Consumables
        </span>
      </div>
    </Card>
  );
}

export default function SupplierFinancialsPage() {
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const { data: company } = useSupplierCompany();

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
          Financials
        </h1>
        <p className="text-muted-text mt-1">Your company&apos;s financials at a glance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SupplierTierCard />

        <div className="flex flex-col gap-6">
          <div className="bg-gradient-to-br from-supplier-purple-start to-supplier-purple-end rounded-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet size={16} className="text-white" />
              </span>
              <span className="text-white/80 text-sm">Purchased Credits</span>
            </div>
            <p className="text-white text-3xl font-extrabold">
              {company ? company.purchasedCredits : "…"} Credits
            </p>
            <p className="text-white/70 text-xs mt-1 mb-4">Shared across your whole team.</p>
            <button
              type="button"
              onClick={() => setTopUpOpen(true)}
              className="w-full h-10 rounded font-medium bg-white text-supplier-purple-start hover:bg-white/90 transition-colors"
            >
              Top Up
            </button>
          </div>

          <div className="bg-gradient-to-br from-supplier-purple-start to-user-teal-start rounded-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                <Gift size={16} className="text-white" />
              </span>
              <span className="text-white/80 text-sm">Earned Credits</span>
            </div>
            <p className="text-white text-3xl font-extrabold">{company ? company.earnedCredits : "…"} Credits</p>
            <p className="text-white/70 text-xs mt-1 mb-4">Earned automatically as your bookings complete.</p>
            <button
              type="button"
              onClick={() => setRewardsOpen(true)}
              className="w-full h-10 rounded font-medium bg-white text-supplier-purple-start hover:bg-white/90 transition-colors"
            >
              Check out your redeemable rewards!
            </button>
          </div>
        </div>
      </div>

      <PlatformRevenueCard />

      <Card>
        <h3 className="flex items-center gap-2 text-base font-semibold text-body-text mb-2">
          <Landmark size={18} className="text-supplier-purple-end" />
          Accounts Receivable, Receipts &amp; Invoices
        </h3>
        <p className="text-sm text-muted-text">
          Not wired yet — there&apos;s no Invoice, Receipt, or payout concept in the schema at
          all (Sprint 6&apos;s Stripe integration is unbuilt). Tracked as a backend gap.
        </p>
      </Card>

      <SupplierRewardsCatalogueModal
        open={rewardsOpen}
        onClose={() => setRewardsOpen(false)}
        earnedCredits={company?.earnedCredits ?? 0}
      />
      <CompanyTopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}
