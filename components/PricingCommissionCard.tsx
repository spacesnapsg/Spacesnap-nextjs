"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Pagination from "@/components/Pagination";
import { ApiRequestError } from "@/lib/api-client";
import {
  useAdminPricing,
  useUpdatePlatformPricing,
  useUpdateCompanyPricing,
  PRICING_FIELDS,
  PRICING_FIELD_LABELS,
  type PricingField,
  type PlatformPricingConfig,
  type CompanyPricing,
} from "@/lib/hooks/useAdminPricing";

const gradientBtn = "!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end h-9 px-4 text-xs whitespace-nowrap";

// Platform-wide defaults editor. Percentages are whole numbers (50 = 50%).
function PlatformDefaults({ config }: { config: PlatformPricingConfig }) {
  const [values, setValues] = useState<Record<PricingField, string>>(() =>
    Object.fromEntries(PRICING_FIELDS.map((f) => [f, String(config[f])])) as Record<PricingField, string>
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const update = useUpdatePlatformPricing();

  function handleSave() {
    setError(null);
    setSaved(false);
    const patch: Partial<Record<PricingField, number>> = {};
    for (const f of PRICING_FIELDS) {
      const n = Number(values[f]);
      if (values[f].trim() === "" || !Number.isFinite(n) || n < 0) {
        setError(`${PRICING_FIELD_LABELS[f]} must be a number of at least 0.`);
        return;
      }
      patch[f] = n;
    }
    update.mutate(patch, {
      onSuccess: () => setSaved(true),
      onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong."),
    });
  }

  return (
    <div className="px-6 pt-2 pb-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-text mb-3">Platform Defaults</h3>
      <div className="flex flex-wrap gap-4">
        {PRICING_FIELDS.map((f) => (
          <label key={f} className="flex flex-col gap-1 text-xs text-muted-text">
            {PRICING_FIELD_LABELS[f]} (%)
            <Input
              type="number"
              min="0"
              step="0.01"
              value={values[f]}
              onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
              className="h-9 text-sm w-28"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Button onClick={handleSave} disabled={update.isPending} className={gradientBtn}>
          Save Defaults
        </Button>
        {saved && <span className="text-xs text-success-green">Saved.</span>}
        {error && <span className="text-xs text-error-red">{error}</span>}
      </div>
    </div>
  );
}

// One company's override row. An empty field inherits the platform default
// (shown as the input placeholder).
function CompanyRow({ company, config }: { company: CompanyPricing; config: PlatformPricingConfig }) {
  const [values, setValues] = useState<Record<PricingField, string>>(() =>
    Object.fromEntries(
      PRICING_FIELDS.map((f) => [f, company.overrides[f] === null ? "" : String(company.overrides[f])])
    ) as Record<PricingField, string>
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const update = useUpdateCompanyPricing();

  function handleSave() {
    setError(null);
    setSaved(false);
    const patch: Partial<Record<PricingField, number | null>> = {};
    for (const f of PRICING_FIELDS) {
      if (values[f].trim() === "") {
        patch[f] = null;
        continue;
      }
      const n = Number(values[f]);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${PRICING_FIELD_LABELS[f]} must be a number of at least 0, or blank to inherit.`);
        return;
      }
      patch[f] = n;
    }
    update.mutate(
      { companyId: company.companyId, patch },
      {
        onSuccess: () => setSaved(true),
        onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong."),
      }
    );
  }

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="py-3 px-6 text-sm text-body-text whitespace-nowrap">
        {company.companyName}
        {saved && <span className="block text-xs text-success-green mt-0.5">Saved.</span>}
        {error && <span className="block text-xs text-error-red mt-0.5">{error}</span>}
      </td>
      {PRICING_FIELDS.map((f) => (
        <td key={f} className="py-3 px-3">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values[f]}
            placeholder={String(config[f])}
            onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
            className="h-9 text-sm w-24"
            aria-label={`${company.companyName} ${PRICING_FIELD_LABELS[f]}`}
          />
        </td>
      ))}
      <td className="py-3 px-6">
        <Button onClick={handleSave} disabled={update.isPending} variant="ghost" className="h-9 px-3 text-xs">
          Save
        </Button>
      </td>
    </tr>
  );
}

// Admin-only "Pricing & Commission" panel — platform defaults plus per-supplier
// overrides. Placed on the admin Financials page; easy to relocate. Suppliers
// have no access to any of this.
export default function PricingCommissionCard() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminPricing({ search: search.trim() || undefined, page });

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-6 pb-2">
        <h2 className="text-lg font-semibold text-body-text">Pricing &amp; Commission</h2>
        <p className="text-xs text-muted-text mt-0.5">
          The marketplace price is a supplier&apos;s base price plus the booking-type markup; SpaceSnap keeps that markup
          plus the commission. Set platform defaults, or override per supplier (blank inherits the default).
        </p>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-text text-center py-12">Loading…</p>
      ) : (
        <>
          <PlatformDefaults config={data.config} />

          <div className="px-6 pt-2 pb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-text">Per-Supplier Overrides</h3>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search suppliers…"
                className="w-full sm:w-56 bg-background border border-border/40 rounded py-2 pr-3 pl-9 text-xs text-body-text placeholder:text-muted-text focus:outline-none focus:border-admin-red-start transition-colors"
              />
            </div>
          </div>
          {data.companies.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">
              {search.trim() ? "No suppliers match your search." : "No suppliers yet."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto pb-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-6 text-xs font-medium uppercase tracking-wide text-muted-text">Supplier</th>
                      {PRICING_FIELDS.map((f) => (
                        <th key={f} className="py-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-text">
                          {PRICING_FIELD_LABELS[f]}
                        </th>
                      ))}
                      <th className="py-2 px-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.companies.map((company) => (
                      <CompanyRow key={company.companyId} company={company} config={data.config} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6">
                <Pagination page={data.meta.page} pageSize={data.meta.perPage} total={data.meta.total} onPageChange={setPage} />
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}
