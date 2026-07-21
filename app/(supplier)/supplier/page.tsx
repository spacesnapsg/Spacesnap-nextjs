"use client";

import { CalendarCheck, Package } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/components/Card";
import { useSupplierBookings, type BookingStatus } from "@/lib/hooks/useSupplierBookings";
import { useSupplierListings } from "@/lib/hooks/useSupplierListings";
import { useSupplierRevenue } from "@/lib/hooks/useSupplierRevenue";

function formatMonthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

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

export default function SupplierAnalyticsPage() {
  const { data: bookings, isLoading: bookingsLoading } = useSupplierBookings();
  const { data: listings, isLoading: listingsLoading } = useSupplierListings();
  const { data: revenueMonths, isLoading: revenueLoading } = useSupplierRevenue();

  const activeBookings = (bookings ?? []).filter((b) => b.status === "active" || b.status === "confirmed").length;
  const recentBookings = [...(bookings ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

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
          value={bookingsLoading ? "…" : String(activeBookings)}
          icon={CalendarCheck}
        />
        <StatCard
          label="Total Listings"
          value={listingsLoading ? "…" : String((listings ?? []).length)}
          icon={Package}
        />
      </div>

      <Card className="mb-8">
        <h2 className="text-lg font-semibold text-body-text mb-6">Revenue Over Time</h2>
        {revenueLoading ? (
          <p className="text-sm text-muted-text">Loading…</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(revenueMonths ?? []).map((m) => ({
                  label: formatMonthLabel(m.month),
                  revenue: Number(m.revenue),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  formatter={(value) => [`${value} credits`, "Revenue"]}
                  contentStyle={{
                    backgroundColor: "#151a23",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "#e5e7eb" }}
                />
                <Bar dataKey="revenue" fill="#9333ea" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-body-text mb-6">Recent Bookings</h2>
        {bookingsLoading ? (
          <p className="text-sm text-muted-text">Loading…</p>
        ) : recentBookings.length === 0 ? (
          <p className="text-sm text-muted-text">No bookings yet.</p>
        ) : (
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
        )}
      </Card>
    </div>
  );
}
