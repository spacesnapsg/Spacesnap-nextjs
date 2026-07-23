"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Trophy, Wallet, Gift, Landmark } from "lucide-react";
import Card from "@/components/Card";
import Pagination from "@/components/Pagination";
import DateRangePicker from "@/components/DateRangePicker";
import SupplierRewardsCatalogueModal from "@/components/SupplierRewardsCatalogueModal";
import SupplierTierBenefitsModal from "@/components/SupplierTierBenefitsModal";
import CompanyTopUpModal from "@/components/CompanyTopUpModal";
import { useSupplierCompany, type SupplierTier } from "@/lib/hooks/useSupplierCompany";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useCompanyTransactions } from "@/lib/hooks/useCompanyTransactions";
import { useDateRangeFilter } from "@/lib/hooks/useDateRangeFilter";

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
// (confirmed by the product owner 2026-07-23 — bookings/cancellation-rate/
// spend, replacing the original rating-based criteria) — the label/
// requirement text is static since the thresholds themselves are constants,
// but progressPercent below comes from the live GET /api/supplier/company
// response (company.tierStats), not a placeholder.
const NEXT_TIER: Record<SupplierTier, { label: string; requirement: string } | null> = {
  free: { label: "Preferred", requirement: "50 bookings, <10% cancellation rate & 50,000 credits spend" },
  preferred: { label: "Top", requirement: "100 bookings, <3% cancellation rate & 100,000 credits spend" },
  top: null,
};

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
          // Every tier pays out biweekly as of 2026-07-23 (see
          // SUPPLIER_TIER_PAYOUT_CADENCE, lib/booking-payments.ts) —
          // CADENCE_LABELS keeps monthly/weekly too, for any SupplierPayable
          // row snapshotted before that change.
          <p className="text-xs text-muted-text mt-1">{CADENCE_LABELS[company.payoutCadence]} payout</p>
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

// Company-admin-only ledger feed for CompanyTransaction — the shared
// purchased/earned credit pool's audit trail had a write path
// (lib/company-credits.ts) but nothing read it back until now (Sprint 6.10
// "Supplier Analytics/Financials Reshuffle", 2026-07-23). Same pagination +
// date-range treatment as every other audit-trail feed in this codebase.
function CreditMovementCard() {
  const range = useDateRangeFilter("all");
  const { data, isLoading } = useCompanyTransactions({ from: range.from, to: range.to }, range.page);
  const transactions = data?.transactions;

  return (
    <Card className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-body-text">Credit Movement</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Every top-up, rebate, and redemption against your company&apos;s shared credit pool.
          </p>
        </div>
        <DateRangePicker
          preset={range.preset}
          from={range.from}
          to={range.to}
          onPresetChange={range.changePreset}
          onFromChange={range.changeFrom}
          onToChange={range.changeTo}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-text py-4">Loading…</p>
      ) : !transactions || transactions.length === 0 ? (
        <p className="text-sm text-muted-text py-4">
          No credit movement {range.from || range.to ? "in the selected date range" : "yet"}.
        </p>
      ) : (
        <>
          <div className="divide-y divide-border/40">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-body-text">{t.description}</p>
                  <p className="text-xs text-muted-text mt-0.5">
                    {t.userName ?? "Automatic"} · {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className={`text-sm font-medium whitespace-nowrap ${t.amount >= 0 ? "text-success-green" : "text-body-text"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount} Credits
                </p>
              </div>
            ))}
          </div>
          <Pagination
            page={range.page}
            pageSize={data?.meta.pageSize ?? 10}
            total={data?.meta.total ?? 0}
            onPageChange={range.setPage}
          />
        </>
      )}
    </Card>
  );
}

export default function SupplierFinancialsPage() {
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const { data: company } = useSupplierCompany();
  const { data: session } = useSession();

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

      {session?.user?.isCompanyAdmin && <CreditMovementCard />}

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
