import Link from "next/link";
import { Award, CalendarCheck, CalendarClock, MapPin, Wallet } from "lucide-react";
import Card from "@/components/Card";
import { MOCK_CURRENT_USER_WALLET } from "@/lib/mockWallet";
import { MOCK_LISTINGS } from "@/lib/mockListings";
import {
  MOCK_ACTIVE_CHECK_INS,
  MOCK_ACTIVITY_LOG,
  MOCK_DASHBOARD_USERS,
  MOCK_UPCOMING_BOOKINGS,
  TOTAL_BOOKINGS,
  type ActivityActionType,
  type Booking,
  type CheckIn,
} from "@/lib/mockDashboard";

const BOOKING_STATUS_STYLES: Record<Booking["status"], string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  active: "bg-success-green/15 text-success-green border-success-green/30",
  completed: "bg-muted-text/15 text-muted-text border-border",
  cancelled: "bg-red-400/15 text-red-400 border-red-400/30",
};

const BOOKING_TYPE_LABELS: Record<Booking["booking_type"], string> = {
  daily: "Full Day",
  weekly: "Full Week",
  monthly: "Full Month",
};

const ACTIVITY_STYLES: Record<ActivityActionType, { icon: typeof CalendarCheck; className: string }> = {
  booking: { icon: CalendarCheck, className: "bg-user-teal-start/15 text-user-teal-end" },
  certification: { icon: Award, className: "bg-amber/15 text-amber" },
  checkin: { icon: MapPin, className: "bg-success-green/15 text-success-green" },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(dateString: string) {
  const diffDays = Math.round((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  const weeks = Math.round(diffDays / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

function getListingName(listingId: number) {
  return MOCK_LISTINGS.find((listing) => listing.id === listingId)?.name ?? "Unknown Listing";
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function UpcomingBookingRow({ booking }: { booking: Booking }) {
  return (
    <div className="flex items-center justify-between bg-background border border-border/60 rounded px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-9 w-9 shrink-0 rounded-full bg-card border border-border flex items-center justify-center">
          <CalendarClock size={16} className="text-user-teal-end" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-body-text font-medium truncate">{getListingName(booking.listing_id)}</p>
          <p className="text-xs text-muted-text">
            {formatDate(booking.start_date)} · {BOOKING_TYPE_LABELS[booking.booking_type]}
          </p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${BOOKING_STATUS_STYLES[booking.status]}`}
      >
        {booking.status}
      </span>
    </div>
  );
}

function ActiveUserAvatar({ checkIn }: { checkIn: CheckIn }) {
  const name = MOCK_DASHBOARD_USERS.find((user) => user.id === checkIn.user_id)?.name ?? "Unknown";

  return (
    <div className="flex flex-col items-center gap-2 text-center w-20 shrink-0">
      <span className="h-14 w-14 rounded-full bg-gradient-to-br from-user-teal-start to-user-teal-end flex items-center justify-center text-white font-semibold text-lg">
        {getInitial(name)}
      </span>
      <div>
        <p className="text-sm text-body-text font-medium truncate w-20">{name}</p>
        <p className="text-xs text-muted-text truncate w-20">{getListingName(checkIn.listing_id)}</p>
      </div>
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-user-teal-start to-user-teal-end bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-text mt-1">Your activity at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <Card className="flex flex-col gap-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-user-teal-start to-user-teal-end flex items-center justify-center">
            <CalendarCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-muted-text text-sm">Total Bookings</p>
            <p className="text-2xl font-semibold text-body-text mt-1">{TOTAL_BOOKINGS}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-user-teal-start to-user-teal-end flex items-center justify-center">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <p className="text-muted-text text-sm">Credit Balance</p>
            <p className="text-2xl font-semibold text-body-text mt-1">
              {MOCK_CURRENT_USER_WALLET.credit_balance} cr
            </p>
            <Link href="/wallet" className="text-xs text-user-teal-end hover:underline mt-2 inline-block">
              View Wallet
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-body-text mb-4">Upcoming Bookings</h2>
        <div className="flex flex-col gap-3">
          {MOCK_UPCOMING_BOOKINGS.map((booking) => (
            <UpcomingBookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-body-text">Currently Active</h2>
        <p className="text-sm text-muted-text mb-5">See who&apos;s checked in right now</p>
        <div className="flex gap-6 overflow-x-auto pb-1">
          {MOCK_ACTIVE_CHECK_INS.map((checkIn) => (
            <ActiveUserAvatar key={checkIn.id} checkIn={checkIn} />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-body-text mb-2">Recent Activity</h2>
        <div className="flex flex-col">
          {MOCK_ACTIVITY_LOG.map((activity) => {
            const { icon: Icon, className } = ACTIVITY_STYLES[activity.action_type];
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0"
              >
                <span className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${className}`}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-body-text font-medium truncate">{activity.description}</p>
                  <p className="text-xs text-muted-text">{formatRelativeTime(activity.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
