"use client";

import { DollarSign, TrendingUp, Building2, Receipt } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import Card from "@/components/Card";
import {
  MOCK_MONTHLY_REVENUE,
  MOCK_REVENUE_BY_OPERATOR,
  MOCK_TOTAL_PLATFORM_REVENUE,
  MOCK_TOTAL_COMPANIES,
  MOCK_TOTAL_TRANSACTIONS,
  MOCK_RECENT_TRANSACTIONS,
  type AdminTransaction,
} from "@/lib/mockAdminFinancials";

const THIS_MONTH_REVENUE = MOCK_MONTHLY_REVENUE[MOCK_MONTHLY_REVENUE.length - 1].revenue;
const AVG_REVENUE_PER_OPERATOR = Math.round(MOCK_TOTAL_PLATFORM_REVENUE / MOCK_TOTAL_COMPANIES);

const STATS = [
  { label: "Total Platform Revenue", value: `${MOCK_TOTAL_PLATFORM_REVENUE.toLocaleString()} cr`, icon: DollarSign },
  { label: "This Month's Revenue", value: `${THIS_MONTH_REVENUE.toLocaleString()} cr`, icon: TrendingUp },
  { label: "Avg. Revenue per Operator", value: `${AVG_REVENUE_PER_OPERATOR.toLocaleString()} cr`, icon: Building2 },
  { label: "Total Transactions", value: MOCK_TOTAL_TRANSACTIONS.toLocaleString(), icon: Receipt },
];

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof DollarSign }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-admin-red-start to-admin-orange-end flex items-center justify-center">
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-muted-text text-sm">{label}</p>
        <p className="text-2xl font-semibold text-body-text mt-1">{value}</p>
      </div>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-3 py-2 text-sm">
      <p className="text-muted-text mb-1">{label}</p>
      <p className="text-body-text font-medium">{Number(payload[0].value).toLocaleString()} cr</p>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: AdminTransaction }) {
  const isCredit = transaction.type === "credit";
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="py-3 pr-4 text-sm text-body-text font-medium whitespace-nowrap">{transaction.user}</td>
      <td className="py-3 pr-4 text-sm text-muted-text whitespace-nowrap">{transaction.company}</td>
      <td className="py-3 pr-4 text-sm text-muted-text">{transaction.description}</td>
      <td className={`py-3 pr-4 text-sm font-medium whitespace-nowrap ${isCredit ? "text-success-green" : "text-error-red"}`}>
        {isCredit ? "+" : "-"}
        {transaction.amount} cr
      </td>
      <td className="py-3 pr-4 whitespace-nowrap">
        <span
          className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${
            isCredit
              ? "bg-success-green/15 text-success-green border-success-green/30"
              : "bg-error-red/15 text-error-red border-error-red/30"
          }`}
        >
          {isCredit ? "Credit" : "Debit"}
        </span>
      </td>
      <td className="py-3 text-sm text-muted-text whitespace-nowrap">{transaction.date}</td>
    </tr>
  );
}

export default function AdminFinancialsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Platform Financials
        </h1>
        <p className="text-muted-text mt-1">Revenue and transaction activity across all operators</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <Card className="mb-8">
        <h2 className="text-lg font-semibold text-body-text mb-4">Platform Revenue Over Time</h2>
        <div className="h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MOCK_MONTHLY_REVENUE} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2937" vertical={false} />
              <XAxis dataKey="month" stroke="#9ca3af" tickLine={false} axisLine={{ stroke: "#1f2937" }} />
              <YAxis stroke="#9ca3af" tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip content={ChartTooltip} cursor={{ stroke: "#1f2937" }} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="url(#revenueLineGradient)"
                strokeWidth={3}
                dot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mb-8">
        <h2 className="text-lg font-semibold text-body-text mb-4">Revenue by Operator</h2>
        <div className="h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_REVENUE_BY_OPERATOR} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2937" vertical={false} />
              <XAxis dataKey="company" stroke="#9ca3af" tickLine={false} axisLine={{ stroke: "#1f2937" }} />
              <YAxis stroke="#9ca3af" tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(249,115,22,0.08)" }} />
              <Bar dataKey="revenue" fill="url(#revenueBarGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-body-text mb-4">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted-text uppercase tracking-wide">User</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-text uppercase tracking-wide">Company</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-text uppercase tracking-wide">Description</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-text uppercase tracking-wide">Amount</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-text uppercase tracking-wide">Type</th>
                <th className="pb-2 text-xs font-medium text-muted-text uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_RECENT_TRANSACTIONS.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
