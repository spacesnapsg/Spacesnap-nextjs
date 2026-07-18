import { DollarSign, CalendarCheck, Package, Star } from "lucide-react";
import Card from "@/components/Card";
import {
  MOCK_SUPPLIER_STATS,
  MOCK_REVENUE_BARS,
  MOCK_SUPPLIER_RECENT_BOOKINGS,
  type SupplierBookingStatus,
} from "@/lib/mockSupplierDashboard";

const STAT_ICONS = [DollarSign, CalendarCheck, Package, Star];

const STATUS_STYLES: Record<SupplierBookingStatus, string> = {
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  active: "bg-success-green/15 text-success-green border-success-green/30",
  pending: "bg-muted-text/15 text-muted-text border-border",
  cancelled: "bg-error-red/15 text-error-red border-error-red/30",
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof DollarSign }) {
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
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
          Analytics Dashboard
        </h1>
        <p className="text-muted-text mt-1">Track your listings performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {MOCK_SUPPLIER_STATS.map((stat, i) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} icon={STAT_ICONS[i]} />
        ))}
      </div>

      <Card className="mb-8">
        <h2 className="text-lg font-semibold text-body-text mb-6">Revenue Over Time</h2>
        <div className="flex items-end gap-4 h-44 px-2">
          {MOCK_REVENUE_BARS.map((height, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-lg bg-gradient-to-t from-supplier-purple-end to-supplier-purple-start"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="flex gap-4 px-2 mt-2">
          {MOCK_REVENUE_BARS.map((_, i) => (
            <span key={i} className="flex-1 text-center text-xs text-muted-text">
              W{i + 1}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-body-text mb-6">Recent Bookings</h2>
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
              {MOCK_SUPPLIER_RECENT_BOOKINGS.map((booking) => (
                <tr key={booking.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-4 text-body-text whitespace-nowrap">{booking.user}</td>
                  <td className="py-3 pr-4 text-body-text whitespace-nowrap">{booking.listing}</td>
                  <td className="py-3 pr-4 text-muted-text capitalize whitespace-nowrap">{booking.type}</td>
                  <td className="py-3 pr-4 text-body-text whitespace-nowrap">{booking.credits} cr</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="py-3 text-muted-text whitespace-nowrap">{booking.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
