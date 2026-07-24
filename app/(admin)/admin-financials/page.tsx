"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useAdminFinancials } from "@/lib/hooks/useAdminFinancials";
import {
  useAdminSupplierPayouts,
  useCreateSupplierPayout,
  useSetSupplierPayoutBillUrl,
  useMarkSupplierPayoutPaid,
  type PendingPayableCompany,
  type AdminSupplierPayout,
} from "@/lib/hooks/useAdminSupplierPayouts";
import { ApiRequestError } from "@/lib/api-client";

const TYPE_LABELS: Record<string, string> = {
  booking: "Booking",
  purchase: "Purchase",
  refund: "Refund",
  topup: "Top-up",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Manual-entry version of the payout close-out workflow — no live Xero API
// connection exists yet (no Xero Developer app registered, confirmed
// 2026-07-24), so an admin closes a period, pastes the Xero Bill URL once
// it's generated, then pastes the Remittance Advice URL once the transfer
// clears. See lib/supplier-payouts.ts for the full design rationale; real
// Xero API sync is a clean follow-up once credentials exist.
function ReadyToBillRow({ company }: { company: PendingPayableCompany }) {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [xeroBillUrl, setXeroBillUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateSupplierPayout();

  function handleSubmit() {
    setError(null);
    if (!periodStart || !periodEnd) {
      setError("Pick a period start and end date.");
      return;
    }
    create.mutate(
      { companyId: company.companyId, periodStart, periodEnd, xeroBillUrl: xeroBillUrl || undefined },
      {
        onSuccess: () => {
          setPeriodStart("");
          setPeriodEnd("");
          setXeroBillUrl("");
        },
        onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong."),
      }
    );
  }

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="py-3 px-6 text-sm text-body-text whitespace-nowrap">
        {company.companyName}
        {company.oldestPendingSince && (
          <p className="text-xs text-muted-text mt-0.5">Since {formatDate(company.oldestPendingSince)}</p>
        )}
      </td>
      <td className="py-3 px-6 text-sm text-body-text text-right whitespace-nowrap">{company.pendingTotal} credits</td>
      <td className="py-3 px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="h-9 text-xs w-36"
            aria-label="Period start"
          />
          <span className="text-xs text-muted-text">to</span>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="h-9 text-xs w-36"
            aria-label="Period end"
          />
          <Input
            type="url"
            value={xeroBillUrl}
            onChange={(e) => setXeroBillUrl(e.target.value)}
            placeholder="Xero Bill URL (optional)"
            className="h-9 text-xs w-48"
          />
          <Button
            onClick={handleSubmit}
            disabled={create.isPending}
            className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end h-9 px-3 text-xs whitespace-nowrap"
          >
            Close Period &amp; Create Bill
          </Button>
        </div>
        {error && <p className="text-xs text-error-red mt-1">{error}</p>}
      </td>
    </tr>
  );
}

function AwaitingPaymentRow({ payout }: { payout: AdminSupplierPayout }) {
  const [xeroBillUrl, setXeroBillUrl] = useState(payout.xeroBillUrl ?? "");
  const [xeroRemittanceUrl, setXeroRemittanceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setBillUrl = useSetSupplierPayoutBillUrl();
  const markPaid = useMarkSupplierPayoutPaid();

  function handleSaveBillUrl() {
    setError(null);
    if (!xeroBillUrl) {
      setError("Enter the Xero Bill URL first.");
      return;
    }
    setBillUrl.mutate(
      { id: payout.id, xeroBillUrl },
      { onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong.") }
    );
  }

  function handleMarkPaid() {
    setError(null);
    if (!xeroRemittanceUrl) {
      setError("Enter the Xero Remittance Advice URL first.");
      return;
    }
    markPaid.mutate(
      { id: payout.id, xeroRemittanceUrl },
      { onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong.") }
    );
  }

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="py-3 px-6 text-sm text-body-text whitespace-nowrap">
        {payout.companyName}
        <p className="text-xs text-muted-text mt-0.5">
          {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
        </p>
      </td>
      <td className="py-3 px-6 text-sm text-body-text text-right whitespace-nowrap">{payout.totalAmount} credits</td>
      <td className="py-3 px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="url"
            value={xeroBillUrl}
            onChange={(e) => setXeroBillUrl(e.target.value)}
            placeholder="Xero Bill URL"
            className="h-9 text-xs w-48"
          />
          <Button
            onClick={handleSaveBillUrl}
            disabled={setBillUrl.isPending}
            variant="ghost"
            className="h-9 px-3 text-xs whitespace-nowrap"
          >
            Save Bill Link
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Input
            type="url"
            value={xeroRemittanceUrl}
            onChange={(e) => setXeroRemittanceUrl(e.target.value)}
            placeholder="Xero Remittance Advice URL"
            className="h-9 text-xs w-48"
          />
          <Button
            onClick={handleMarkPaid}
            disabled={markPaid.isPending}
            className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end h-9 px-3 text-xs whitespace-nowrap"
          >
            Mark Paid
          </Button>
        </div>
        {error && <p className="text-xs text-error-red mt-1">{error}</p>}
      </td>
    </tr>
  );
}

// Admin close-out queue for SupplierPayout batches — sits above the
// Cross-Company Transaction Feed since closing a period is the more
// time-sensitive admin action on this page. Two stages, matching the
// SupplierPayable pending -> scheduled -> paid lifecycle: companies with an
// un-batched balance ("Ready to Bill") and batches already billed awaiting
// payment confirmation ("Awaiting Payment").
function SupplierPayoutsCard() {
  const { data, isLoading } = useAdminSupplierPayouts();

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-6 pb-2">
        <h2 className="text-lg font-semibold text-body-text">Supplier Payouts</h2>
        <p className="text-xs text-muted-text mt-0.5">
          Close a period to bill a supplier&apos;s accrued balance, then confirm once Xero shows the transfer paid.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-text text-center py-12">Loading…</p>
      ) : (
        <>
          <div className="px-6 pt-2 pb-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-text">Ready to Bill</h3>
          </div>
          {!data || data.pendingCompanies.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">No un-batched pending balances.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">Company</th>
                    <th className="py-2 px-6 text-xs font-medium uppercase tracking-wide text-muted-text text-right">
                      Pending Balance
                    </th>
                    <th className="py-2 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">
                      Close Period
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingCompanies.map((company) => (
                    <ReadyToBillRow key={company.companyId} company={company} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 pt-4 pb-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-text">Awaiting Payment</h3>
          </div>
          {!data || data.awaitingPayment.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">No batches awaiting payment.</p>
          ) : (
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">
                      Company / Period
                    </th>
                    <th className="py-2 px-6 text-xs font-medium uppercase tracking-wide text-muted-text text-right">
                      Total
                    </th>
                    <th className="py-2 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">
                      Confirm Payment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.awaitingPayment.map((payout) => (
                    <AwaitingPaymentRow key={payout.id} payout={payout} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

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
                        {row.revenue} credits
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <SupplierPayoutsCard />

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
                            {row.amount} credits
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
