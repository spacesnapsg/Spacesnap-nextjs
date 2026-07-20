"use client";

import { useMemo, useState } from "react";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import Card from "@/components/Card";
import TopUpCreditsModal from "@/components/TopUpCreditsModal";
import { useWallet, type WalletTransaction } from "@/lib/hooks/useWallet";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isCreditType(type: WalletTransaction["type"]) {
  return type === "topup" || type === "refund";
}

// Derived from the real transaction ledger rather than a dedicated stats
// endpoint — month spend, the prior-month comparison, and the 6-month
// average are all computable client-side from the same rows the
// transaction list already renders.
function computeStats(transactions: WalletTransaction[]) {
  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const thisMonthKey = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = monthKey(lastMonthDate);

  let monthSpend = 0;
  let lastMonthSpend = 0;
  const spendByMonth = new Map<string, number>();

  for (const t of transactions) {
    if (isCreditType(t.type)) continue;
    const d = new Date(t.createdAt);
    const key = monthKey(d);
    const spend = Math.abs(t.amount);
    spendByMonth.set(key, (spendByMonth.get(key) ?? 0) + spend);
    if (key === thisMonthKey) monthSpend += spend;
    if (key === lastMonthKey) lastMonthSpend += spend;
  }

  const monthSpendChangePct = lastMonthSpend > 0 ? ((monthSpend - lastMonthSpend) / lastMonthSpend) * 100 : 0;
  const monthlyTotals = [...spendByMonth.values()];
  const avgMonthlySpend =
    monthlyTotals.length > 0 ? monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length : 0;

  return { monthSpend, monthSpendChangePct, avgMonthlySpend };
}

// Running balance over time, oldest first, so the sparkline shows the same
// trend a dedicated balance-history endpoint would.
function computeBalanceTrend(transactions: WalletTransaction[], currentBalance: number): number[] {
  const chronological = [...transactions].reverse();
  let balance = currentBalance - chronological.reduce((sum, t) => sum + t.amount, 0);
  const trend = [balance];
  for (const t of chronological) {
    balance += t.amount;
    trend.push(balance);
  }
  return trend.slice(-7);
}

function BalanceTrendChart({ data }: { data: number[] }) {
  const width = 200;
  const height = 64;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        className="stroke-user-teal-end"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const isCredit = isCreditType(transaction.type);
  const Icon = isCredit ? ArrowDownCircle : ArrowUpCircle;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${
            isCredit ? "bg-success-green/15 text-success-green" : "bg-red-400/15 text-red-400"
          }`}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-body-text font-medium truncate">{transaction.description}</p>
          <p className="text-xs text-muted-text">{formatDate(transaction.createdAt)}</p>
        </div>
      </div>
      <p className={`text-sm font-medium shrink-0 ${isCredit ? "text-success-green" : "text-red-400"}`}>
        {isCredit ? "+" : "-"}
        {Math.abs(transaction.amount)} cr
      </p>
    </div>
  );
}

export default function CreditWalletPage() {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const { data: wallet, isLoading, isError } = useWallet();

  const stats = useMemo(() => (wallet ? computeStats(wallet.transactions) : null), [wallet]);
  const trend = useMemo(
    () => (wallet ? computeBalanceTrend(wallet.transactions, wallet.balance) : []),
    [wallet]
  );

  if (isLoading) {
    return <p className="text-sm text-muted-text text-center py-16">Loading wallet…</p>;
  }

  if (isError || !wallet) {
    return <p className="text-sm text-error-red text-center py-16">Failed to load wallet.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-user-teal-start to-user-teal-end bg-clip-text text-transparent">
          Credit Wallet
        </h1>
        <p className="text-muted-text mt-1">Manage your credits and payment methods</p>
      </div>

      <div className="bg-gradient-to-br from-user-teal-start to-user-teal-end rounded-card p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <span className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center">
            <Wallet size={20} className="text-white" />
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white/20 text-white rounded-full px-3 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Active
          </span>
        </div>
        <p className="text-white/80 text-sm">Available Balance</p>
        <p className="text-white text-4xl font-extrabold mt-1">{wallet.available} Credits</p>
        <p className="text-white/70 text-xs mt-1 mb-6">
          {wallet.held > 0
            ? `${wallet.balance} total · ${wallet.held} held on confirmed bulk orders`
            : `${wallet.balance} total`}
        </p>
        <button
          type="button"
          onClick={() => setTopUpOpen(true)}
          className="w-full h-11 rounded font-medium bg-white text-user-teal-start hover:bg-white/90 transition-colors"
        >
          Top Up Credits
        </button>
      </div>

      <Card className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-body-text mb-4">
          <CreditCard size={18} className="text-user-teal-end" />
          Payment Methods
        </h2>
        <p className="text-sm text-muted-text">
          Payment methods aren&apos;t available yet — Stripe integration is planned for Sprint 6. Top-ups
          are credits-only for now (no real charge occurs).
        </p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <p className="text-muted-text text-sm">This Month&apos;s Spend</p>
          <p className="text-2xl font-semibold text-body-text mt-1">{stats!.monthSpend.toFixed(2)} cr</p>
          <p className="flex items-center gap-1 text-xs text-success-green mt-2">
            {stats!.monthSpendChangePct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {stats!.monthSpendChangePct >= 0 ? "+" : ""}
            {stats!.monthSpendChangePct.toFixed(1)}% vs last month
          </p>
        </Card>
        <Card>
          <p className="text-muted-text text-sm">Avg. Monthly Spend</p>
          <p className="text-2xl font-semibold text-body-text mt-1">{stats!.avgMonthlySpend.toFixed(2)} cr</p>
          <p className="flex items-center gap-1 text-xs text-muted-text mt-2">
            <TrendingDown size={14} />
            Based on transaction history
          </p>
        </Card>
        <Card>
          <p className="text-muted-text text-sm mb-1">Balance Trend</p>
          {trend.length > 1 ? (
            <BalanceTrendChart data={trend} />
          ) : (
            <p className="text-xs text-muted-text">Not enough history yet</p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-body-text mb-2">Recent Transactions</h2>
        {wallet.transactions.length === 0 ? (
          <p className="text-sm text-muted-text py-4">No transactions yet.</p>
        ) : (
          <div className="flex flex-col max-h-80 overflow-y-auto">
            {wallet.transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}
      </Card>

      <TopUpCreditsModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}
