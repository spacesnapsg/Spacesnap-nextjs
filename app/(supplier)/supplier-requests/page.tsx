"use client";

import { useState } from "react";
import { Mail, Building2, ChevronDown, Plus } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import DeclineReasonModal from "@/components/DeclineReasonModal";
import CertificateRequestModal from "@/components/CertificateRequestModal";
import {
  MOCK_BOOKING_REQUESTS,
  MOCK_BULK_ORDER_REQUESTS,
  MOCK_CERTIFICATE_REQUESTS,
  type BookingRequest,
  type BookingStatus,
  type BulkOrderRequest,
  type BulkOrderStatus,
  type CertificateRequest,
  type CertificateRequestStatus,
} from "@/lib/mockRequests";

type Tab = "bookings" | "bulkOrders" | "certificates";

const TABS: { id: Tab; label: string }[] = [
  { id: "bookings", label: "Bookings" },
  { id: "bulkOrders", label: "Bulk Orders" },
  { id: "certificates", label: "Certificate Requests" },
];

const BOOKING_STATUS_FILTERS: BookingStatus[] = ["pending", "confirmed", "active", "completed", "cancelled"];
const BULK_ORDER_STATUS_FILTERS: BulkOrderStatus[] = ["pending", "confirmed", "fulfilled", "cancelled"];
const CERTIFICATE_STATUS_FILTERS: CertificateRequestStatus[] = ["pending", "confirmed"];

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

const CERTIFICATE_STATUS_STYLES: Record<CertificateRequestStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
};

type DeclineTarget = { type: "booking" | "bulkOrder"; id: number; name: string };
type FilterValue<T extends string> = "all" | T;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function FilterPills<T extends string>({
  options,
  active,
  onChange,
}: {
  options: FilterValue<T>[];
  active: FilterValue<T>;
  onChange: (value: FilterValue<T>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {options.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={`h-9 px-4 rounded-full text-sm font-medium border capitalize transition-colors ${
            active === filter
              ? "bg-supplier-purple-start/20 border-supplier-purple-start text-supplier-purple-end"
              : "bg-card border-border text-muted-text hover:text-body-text"
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status, styles }: { status: string; styles: string }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

function CertBadge({ hasCert, certName }: { hasCert: boolean; certName: string }) {
  return hasCert ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-success-green">
      &#10003; {certName} Certified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber">
      &#9888; Certification Pending
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
      <div className="flex items-start gap-3 min-w-0 md:w-64 shrink-0">
        <div className="w-10 h-10 rounded-full bg-supplier-purple-start/20 text-supplier-purple-end font-semibold flex items-center justify-center shrink-0">
          {getInitials(booking.requesterName)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-body-text leading-snug truncate">{booking.requesterName}</p>
          <p className="text-xs text-muted-text">{booking.requesterRole}</p>
          <div className="mt-1">
            <CertBadge hasCert={booking.hasCert} certName={booking.certName} />
          </div>
        </div>
      </div>

      <div className="min-w-0 md:flex-1">
        <p className="font-medium text-body-text leading-snug truncate">{booking.listingName}</p>
        <p className="text-sm text-muted-text mt-0.5">{booking.dateRange}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-supplier-purple-end font-bold whitespace-nowrap">{booking.credits} cr</p>
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
  expanded,
  onToggleExpand,
  onConfirm,
  onDecline,
  onFulfill,
}: {
  order: BulkOrderRequest;
  expanded: boolean;
  onToggleExpand: (id: number) => void;
  onConfirm: (id: number) => void;
  onDecline: (id: number, name: string) => void;
  onFulfill: (id: number) => void;
}) {
  return (
    <Card className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="min-w-0 md:w-56 shrink-0">
        <p className="font-semibold text-body-text leading-snug">{order.requesterName}</p>
        <p className="text-xs text-muted-text flex items-center gap-1.5 mt-1">
          <Mail size={12} />
          {order.email}
        </p>
        {order.company && (
          <p className="text-xs text-muted-text flex items-center gap-1.5 mt-0.5">
            <Building2 size={12} />
            {order.company}
          </p>
        )}
      </div>

      <div className="min-w-0 md:flex-1">
        <p className="font-medium text-body-text leading-snug">{order.listingName}</p>
        <p className="text-sm text-muted-text mt-0.5">
          Qty: {order.quantity} &middot; Preferred delivery: {order.deliveryDate}
        </p>
        <p className={`text-sm text-muted-text mt-2 ${expanded ? "" : "line-clamp-2"}`}>{order.useCase}</p>
        <button
          type="button"
          onClick={() => onToggleExpand(order.id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-supplier-purple-end mt-1"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-center gap-3">
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
        {order.status === "confirmed" && (
          <Button
            onClick={() => onFulfill(order.id)}
            className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end h-9 px-4 text-sm"
          >
            Fulfilled
          </Button>
        )}
      </div>
    </Card>
  );
}

function CertificateRequestRow({
  request,
  expanded,
  onToggleExpand,
}: {
  request: CertificateRequest;
  expanded: boolean;
  onToggleExpand: (id: number) => void;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-body-text leading-snug">{request.name}</p>
        <StatusBadge status={request.status} styles={CERTIFICATE_STATUS_STYLES[request.status]} />
      </div>
      <div>
        <p className={`text-sm text-muted-text ${expanded ? "" : "line-clamp-2"}`}>{request.context}</p>
        <button
          type="button"
          onClick={() => onToggleExpand(request.id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-supplier-purple-end mt-1"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
    </Card>
  );
}

export default function SupplierRequestsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("bookings");
  const [activeFilter, setActiveFilter] = useState<FilterValue<BookingStatus>>("all");
  const [activeBulkFilter, setActiveBulkFilter] = useState<FilterValue<BulkOrderStatus>>("all");
  const [activeCertFilter, setActiveCertFilter] = useState<FilterValue<CertificateRequestStatus>>("all");
  const [bookings, setBookings] = useState<BookingRequest[]>(MOCK_BOOKING_REQUESTS);
  const [bulkOrders, setBulkOrders] = useState<BulkOrderRequest[]>(MOCK_BULK_ORDER_REQUESTS);
  const [certRequests, setCertRequests] = useState<CertificateRequest[]>(MOCK_CERTIFICATE_REQUESTS);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [certExpandedIds, setCertExpandedIds] = useState<Set<number>>(new Set());
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

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCertExpand(id: number) {
    setCertExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCertificateSubmit({ name, context }: { name: string; context: string }) {
    // Mocked: no backend exists yet for POST /api/certificates
    await new Promise((resolve) => setTimeout(resolve, 600));
    setCertRequests((prev) => [{ id: Date.now(), name, context, status: "pending" }, ...prev]);
  }

  const filteredBookings =
    activeFilter === "all" ? bookings : bookings.filter((b) => b.status === activeFilter);

  const filteredBulkOrders =
    activeBulkFilter === "all" ? bulkOrders : bulkOrders.filter((o) => o.status === activeBulkFilter);

  const filteredCertRequests =
    activeCertFilter === "all" ? certRequests : certRequests.filter((r) => r.status === activeCertFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
          Requests Overview
        </h1>
        <p className="text-muted-text mt-1">Review and manage incoming bookings and bulk orders</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="inline-flex bg-card border border-border rounded-full p-1 gap-1 w-fit">
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

        {activeTab === "certificates" && (
          <Button
            onClick={() => setCertModalOpen(true)}
            className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end gap-1.5 self-start sm:self-auto"
          >
            <Plus size={18} />
            Add New Certificate Request
          </Button>
        )}
      </div>

      {activeTab === "bookings" ? (
        <>
          <FilterPills options={["all", ...BOOKING_STATUS_FILTERS]} active={activeFilter} onChange={setActiveFilter} />

          <div className="flex flex-col gap-4">
            {filteredBookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                onConfirm={(id) => updateBookingStatus(id, "confirmed")}
                onDecline={(id, name) => setDeclineTarget({ type: "booking", id, name })}
              />
            ))}
          </div>
        </>
      ) : activeTab === "bulkOrders" ? (
        <>
          <FilterPills
            options={["all", ...BULK_ORDER_STATUS_FILTERS]}
            active={activeBulkFilter}
            onChange={setActiveBulkFilter}
          />

          <div className="flex flex-col gap-4">
            {filteredBulkOrders.map((order) => (
              <BulkOrderRow
                key={order.id}
                order={order}
                expanded={expandedIds.has(order.id)}
                onToggleExpand={toggleExpand}
                onConfirm={(id) => updateBulkOrderStatus(id, "confirmed")}
                onDecline={(id, name) => setDeclineTarget({ type: "bulkOrder", id, name })}
                onFulfill={(id) => updateBulkOrderStatus(id, "fulfilled")}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <FilterPills
            options={["all", ...CERTIFICATE_STATUS_FILTERS]}
            active={activeCertFilter}
            onChange={setActiveCertFilter}
          />

          <div className="flex flex-col gap-4">
            {filteredCertRequests.length === 0 ? (
              <p className="text-sm text-muted-text text-center py-8">
                {certRequests.length === 0
                  ? "No certificate requests submitted yet."
                  : "No certificate requests match the selected filter."}
              </p>
            ) : (
              filteredCertRequests.map((request) => (
                <CertificateRequestRow
                  key={request.id}
                  request={request}
                  expanded={certExpandedIds.has(request.id)}
                  onToggleExpand={toggleCertExpand}
                />
              ))
            )}
          </div>
        </>
      )}

      <DeclineReasonModal
        open={!!declineTarget}
        onClose={() => setDeclineTarget(null)}
        onConfirm={handleDeclineConfirm}
        requestName={declineTarget?.name}
      />

      <CertificateRequestModal
        open={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        onSubmit={handleCertificateSubmit}
      />
    </div>
  );
}
