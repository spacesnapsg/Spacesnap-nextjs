"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import DeclineReasonModal from "@/components/DeclineReasonModal";
import {
  MOCK_BOOKING_REQUESTS,
  MOCK_BULK_ORDER_REQUESTS,
  type BookingRequest,
  type BookingStatus,
  type BulkOrderRequest,
  type BulkOrderStatus,
} from "@/lib/mockRequests";

type Tab = "bookings" | "bulkOrders";

const TABS: { id: Tab; label: string }[] = [
  { id: "bookings", label: "Booking Requests" },
  { id: "bulkOrders", label: "Bulk Order Requests" },
];

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  active: "bg-supplier-purple-start/15 text-supplier-purple-end border-supplier-purple-start/30",
  completed: "bg-white/10 text-body-text border-white/20",
  cancelled: "bg-error-red/15 text-error-red border-error-red/30",
};

const BULK_ORDER_STATUS_STYLES: Record<BulkOrderStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  fulfilled: "bg-white/10 text-body-text border-white/20",
  cancelled: "bg-error-red/15 text-error-red border-error-red/30",
};

type DeclineTarget = { type: "booking" | "bulkOrder"; id: number; name: string };

function StatusBadge({ status, styles }: { status: string; styles: string }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

function BookingRow({
  booking,
  onConfirm,
  onDecline,
}: {
  booking: BookingRequest;
  onConfirm: (id: number) => void;
  onDecline: (id: number, name: string) => void;
}) {
  return (
    <Card className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="min-w-0 md:w-56 shrink-0">
        <p className="font-semibold text-body-text leading-snug truncate">{booking.requesterName}</p>
      </div>

      <div className="min-w-0 md:flex-1">
        <p className="font-medium text-body-text leading-snug truncate">{booking.listingName}</p>
        <p className="text-sm text-muted-text mt-0.5">{booking.dateRange}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-body-text font-bold whitespace-nowrap">{booking.credits} cr</p>
        <StatusBadge status={booking.status} styles={BOOKING_STATUS_STYLES[booking.status]} />
        {booking.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onConfirm(booking.id)}
              className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end h-9 px-4 text-sm"
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              onClick={() => onDecline(booking.id, booking.requesterName)}
              className="h-9 px-4 text-sm"
            >
              Decline
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function BulkOrderRow({
  order,
  onConfirm,
  onDecline,
}: {
  order: BulkOrderRequest;
  onConfirm: (id: number) => void;
  onDecline: (id: number, name: string) => void;
}) {
  return (
    <Card className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="min-w-0 md:w-56 shrink-0">
        <p className="font-semibold text-body-text leading-snug truncate">{order.requesterName}</p>
      </div>

      <div className="min-w-0 md:flex-1">
        <p className="font-medium text-body-text leading-snug truncate">{order.listingName}</p>
        <p className="text-sm text-muted-text mt-0.5">Qty: {order.quantity}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-body-text font-bold whitespace-nowrap">{order.credits} cr</p>
        <StatusBadge status={order.status} styles={BULK_ORDER_STATUS_STYLES[order.status]} />
        {order.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onConfirm(order.id)}
              className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end h-9 px-4 text-sm"
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              onClick={() => onDecline(order.id, order.requesterName)}
              className="h-9 px-4 text-sm"
            >
              Decline
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SupplierRequestsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("bookings");
  const [bookings, setBookings] = useState<BookingRequest[]>(MOCK_BOOKING_REQUESTS);
  const [bulkOrders, setBulkOrders] = useState<BulkOrderRequest[]>(MOCK_BULK_ORDER_REQUESTS);
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null);

  function updateBookingStatus(id: number, status: BookingStatus) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }

  function updateBulkOrderStatus(id: number, status: BulkOrderStatus) {
    setBulkOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  function handleDeclineConfirm() {
    if (!declineTarget) return;
    if (declineTarget.type === "booking") {
      updateBookingStatus(declineTarget.id, "cancelled");
    } else {
      updateBulkOrderStatus(declineTarget.id, "cancelled");
    }
    setDeclineTarget(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
          Requests Overview
        </h1>
        <p className="text-muted-text mt-1">Review and manage incoming bookings and bulk orders</p>
      </div>

      <div className="inline-flex bg-card border border-border rounded-full p-1 gap-1 w-fit mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-supplier-purple-start/20 border border-supplier-purple-start text-supplier-purple-end"
                : "border border-transparent text-muted-text hover:text-body-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bookings" ? (
        <div className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              onConfirm={(id) => updateBookingStatus(id, "confirmed")}
              onDecline={(id, name) => setDeclineTarget({ type: "booking", id, name })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {bulkOrders.map((order) => (
            <BulkOrderRow
              key={order.id}
              order={order}
              onConfirm={(id) => updateBulkOrderStatus(id, "confirmed")}
              onDecline={(id, name) => setDeclineTarget({ type: "bulkOrder", id, name })}
            />
          ))}
        </div>
      )}

      <DeclineReasonModal
        open={!!declineTarget}
        onClose={() => setDeclineTarget(null)}
        onConfirm={handleDeclineConfirm}
        requestName={declineTarget?.name}
      />
    </div>
  );
}
