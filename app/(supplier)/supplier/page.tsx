"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Package } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/components/Card";
import Pagination from "@/components/Pagination";
import DateRangePicker from "@/components/DateRangePicker";
import { useSupplierBookings, useSupplierBookingsFeed, type BookingStatus } from "@/lib/hooks/useSupplierBookings";
import { useSupplierListings } from "@/lib/hooks/useSupplierListings";
import { useSupplierRevenueByType } from "@/lib/hooks/useSupplierRevenue";
import { useDateRangeFilter } from "@/lib/hooks/useDateRangeFilter";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  active: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  completed: "bg-white/10 text-body-text border-white/20",
  cancelled: "bg-error-red/15 text-error-red border-error-red/30",
  declined_pending_resolution: "bg-error-red/15 text-error-red border-error-red/30",
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CalendarCheck }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-supplier-purple-start to-supplier-purple-end flex items-center justify-center">
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-muted-text text-sm">{label}</p>
        <p className="text-2xl font-semibold text-body-text mt-1">{value}</p>
      </div>
    </Card>
  );
}

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

// Relocated from the Supplier Financials page (Sprint 6.10 "Supplier
// Analytics/Financials Reshuffle", 2026-07-23) — same product-owner request
// as the Recent Bookings pagination below. Supersedes the old "Revenue Over
// Time" card (a flat monthly total off useSupplierRevenue): this is a strict
// superset (the same total, broken down by listing type, with a real range
// picker), so useSupplierRevenue/GET /api/supplier/revenue were removed
// rather than left as an unused duplicate.
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

export default function SupplierAnalyticsPage() {
  // "Active Bookings" stays the full unpaginated feed (unaffected by the
  // Recent Bookings table's own date-range filter below — it's a
  // point-in-time stat, not part of that feed).
  const { data: bookings, isLoading: bookingsStatLoading } = useSupplierBookings();
  const { data: listings, isLoading: listingsLoading } = useSupplierListings();
  const activeBookings = (bookings ?? []).filter((b) => b.status === "active" || b.status === "confirmed").length;

  const bookingsRange = useDateRangeFilter("all");
  const { data: bookingsData, isLoading: bookingsLoading } = useSupplierBookingsFeed(
    { from: bookingsRange.from, to: bookingsRange.to },
    bookingsRange.page
  );
  const recentBookings = bookingsData?.bookings;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
          Analytics Dashboard
        </h1>
        <p className="text-muted-text mt-1">Track your listings performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <StatCard
          label="Active Bookings"
          value={bookingsStatLoading ? "…" : String(activeBookings)}
          icon={CalendarCheck}
        />
        <StatCard
          label="Total Listings"
          value={listingsLoading ? "…" : String((listings ?? []).length)}
          icon={Package}
        />
      </div>

      <PlatformRevenueCard />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <h2 className="text-lg font-semibold text-body-text">Recent Bookings</h2>
          <DateRangePicker
            preset={bookingsRange.preset}
            from={bookingsRange.from}
            to={bookingsRange.to}
            onPresetChange={bookingsRange.changePreset}
            onFromChange={bookingsRange.changeFrom}
            onToChange={bookingsRange.changeTo}
          />
        </div>
        {bookingsLoading ? (
          <p className="text-sm text-muted-text">Loading…</p>
        ) : !recentBookings || recentBookings.length === 0 ? (
          <p className="text-sm text-muted-text">
            No bookings {bookingsRange.from || bookingsRange.to ? "in the selected date range" : "yet"}.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-muted-text border-b border-border/60">
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">User Name</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Listing Name</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Type</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Credits</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Status</th>
                    <th className="pb-3 font-medium whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 pr-4 text-body-text whitespace-nowrap">{booking.userName}</td>
                      <td className="py-3 pr-4 text-body-text whitespace-nowrap">{booking.listingName}</td>
                      <td className="py-3 pr-4 text-muted-text capitalize whitespace-nowrap">{booking.bookingType}</td>
                      <td className="py-3 pr-4 text-body-text whitespace-nowrap">{booking.sgdAmount} credits</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[booking.status]}`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-text whitespace-nowrap">{booking.startDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={bookingsRange.page}
              pageSize={bookingsData?.meta.pageSize ?? 10}
              total={bookingsData?.meta.total ?? 0}
              onPageChange={bookingsRange.setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
