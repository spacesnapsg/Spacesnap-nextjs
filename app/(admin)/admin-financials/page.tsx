"use client";

import Card from "@/components/Card";
import { useAdminFinancials } from "@/lib/hooks/useAdminFinancials";

const TYPE_LABELS: Record<string, string> = {
  booking: "Booking",
  purchase: "Purchase",
  refund: "Refund",
  topup: "Top-up",
};

export default function AdminFinancialsPage() {
  const { data, isLoading, isError } = useAdminFinancials();

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Platform Financials
        </h1>
        <p className="text-muted-text mt-1">Revenue and transaction activity across all operators</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-text text-center py-12">Loading…</p>
      ) : isError || !data ? (
        <p className="text-sm text-error-red text-center py-12">Failed to load financials.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="!p-0 overflow-hidden">
            <div className="p-6 pb-2">
              <h2 className="text-lg font-semibold text-body-text">Revenue by Operator</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">Company</th>
                    <th className="py-3 px-6 text-xs font-medium uppercase tracking-wide text-muted-text text-right">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenueByCompany.map((row) => (
                    <tr key={row.companyId} className="border-b border-border/60 last:border-0">
                      <td className="py-3 px-6 text-sm text-body-text whitespace-nowrap">{row.companyName}</td>
                      <td className="py-3 px-6 text-sm text-body-text text-right whitespace-nowrap">
                        {row.revenue} cr
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="p-6 pb-2">
              <h2 className="text-lg font-semibold text-body-text">Cross-Company Transaction Feed</h2>
            </div>
            {data.transactionFeed.length === 0 ? (
              <p className="text-sm text-muted-text text-center py-12">No revenue transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">Date</th>
                      <th className="py-3 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">Company</th>
                      <th className="py-3 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">Type</th>
                      <th className="py-3 px-6 text-xs font-medium uppercase tracking-wide text-muted-text text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactionFeed.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3 px-6 text-sm text-muted-text whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-6 text-sm text-body-text whitespace-nowrap">
                          {row.companyName ?? "—"}
                        </td>
                        <td className="py-3 px-6 text-sm text-muted-text whitespace-nowrap">
                          {TYPE_LABELS[row.type] ?? row.type}
                        </td>
                        <td className="py-3 px-6 text-sm text-right whitespace-nowrap">
                          <span className={Number(row.amount) < 0 ? "text-error-red" : "text-success-green"}>
                            {Number(row.amount) >= 0 ? "+" : ""}
                            {row.amount} cr
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
