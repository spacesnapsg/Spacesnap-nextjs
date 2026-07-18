"use client";

import { useState } from "react";
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
import {
  MOCK_BALANCE_TREND,
  MOCK_CURRENT_USER_WALLET,
  MOCK_PAYMENT_METHODS,
  MOCK_TRANSACTIONS,
  MOCK_WALLET_STATS,
  type CreditTransaction,
  type PaymentMethod,
} from "@/lib/mockWallet";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BalanceTrendChart({ data }: { data: number[] }) {
  const width = 200;
  const height = 64;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
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

function PaymentMethodRow({ method }: { method: PaymentMethod }) {
  return (
    <div className="flex items-center justify-between bg-background border border-border/60 rounded px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center">
          <CreditCard size={16} className="text-muted-text" />
        </span>
        <div>
          <p className="text-sm text-body-text font-medium">
            {method.brand} •••• {method.last4}
          </p>
          <p className="text-xs text-muted-text">Expires {method.expiry}</p>
        </div>
      </div>
      {method.is_default && (
        <span className="bg-user-teal-start/15 text-user-teal-end border border-user-teal-start/30 rounded-full px-2.5 py-1 text-xs font-medium">
          Default
        </span>
      )}
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: CreditTransaction }) {
  const isCredit = transaction.type === "credit";
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
          <p className="text-xs text-muted-text">{formatDate(transaction.date)}</p>
        </div>
      </div>
      <p className={`text-sm font-medium shrink-0 ${isCredit ? "text-success-green" : "text-red-400"}`}>
        {isCredit ? "+" : "-"}
        {transaction.amount} cr
      </p>
    </div>
  );
}

export default function CreditWalletPage() {
  const [topUpOpen, setTopUpOpen] = useState(false);

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
        <p className="text-white text-4xl font-extrabold mt-1 mb-6">
          {MOCK_CURRENT_USER_WALLET.credit_balance} Credits
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
        <div className="flex flex-col gap-3 mb-4">
          {MOCK_PAYMENT_METHODS.map((method) => (
            <PaymentMethodRow key={method.id} method={method} />
          ))}
        </div>
        <button
          type="button"
          className="w-full h-11 rounded border border-dashed border-border text-muted-text text-sm font-medium hover:text-body-text hover:border-user-teal-start/50 transition-colors"
        >
          Add Payment Method
        </button>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <p className="text-muted-text text-sm">This Month&apos;s Spend</p>
          <p className="text-2xl font-semibold text-body-text mt-1">
            {MOCK_WALLET_STATS.month_spend} cr
          </p>
          <p className="flex items-center gap-1 text-xs text-success-green mt-2">
            <TrendingUp size={14} />
            +{MOCK_WALLET_STATS.month_spend_change_pct}% vs last month
          </p>
        </Card>
        <Card>
          <p className="text-muted-text text-sm">Avg. Monthly Spend</p>
          <p className="text-2xl font-semibold text-body-text mt-1">
            {MOCK_WALLET_STATS.avg_monthly_spend} cr
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-text mt-2">
            <TrendingDown size={14} />
            Last 6 months
          </p>
        </Card>
        <Card>
          <p className="text-muted-text text-sm mb-1">Balance Trend</p>
          <BalanceTrendChart data={MOCK_BALANCE_TREND} />
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-body-text mb-2">Recent Transactions</h2>
        <div className="flex flex-col max-h-80 overflow-y-auto">
          {MOCK_TRANSACTIONS.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      </Card>

      <TopUpCreditsModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  );
}
