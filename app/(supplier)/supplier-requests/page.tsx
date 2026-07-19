"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import DeclineReasonModal from "@/components/DeclineReasonModal";
import CertificateRequestModal from "@/components/CertificateRequestModal";
import {
  useSupplierBookings,
  useConfirmBooking,
  useDeclineBooking,
  type SupplierBooking,
  type BookingStatus,
} from "@/lib/hooks/useSupplierBookings";
import { useSubmittedCertificates } from "@/lib/hooks/useSupplierCertificates";
import { ApiRequestError } from "@/lib/api-client";

type Tab = "bookings" | "bulkOrders" | "certificates";

const TABS: { id: Tab; label: string }[] = [
  { id: "bookings", label: "Bookings" },
  { id: "bulkOrders", label: "Bulk Orders" },
  { id: "certificates", label: "Certificate Requests" },
];

const BOOKING_STATUS_FILTERS: BookingStatus[] = ["pending", "confirmed", "active", "completed", "cancelled"];
const CERTIFICATE_STATUS_FILTERS = ["pending", "approved", "rejected"] as const;
type CertificateStatus = (typeof CERTIFICATE_STATUS_FILTERS)[number];

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  active: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  completed: "bg-white/10 text-body-text border-white/20",
  cancelled: "bg-error-red/15 text-error-red border-error-red/30",
};

const CERTIFICATE_STATUS_STYLES: Record<CertificateStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  approved: "bg-success-green/15 text-success-green border-success-green/30",
  rejected: "bg-error-red/15 text-error-red border-error-red/30",
};

type DeclineTarget = { id: string; name: string };
type FilterValue<T extends string> = "all" | T;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (startDate === endDate) return start;
  const end = new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${start} – ${end}`;
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

function BookingRow({
  booking,
  onConfirm,
  onDecline,
  isMutating,
}: {
  booking: SupplierBooking;
  onConfirm: (id: string) => void;
  onDecline: (id: string, name: string) => void;
  isMutating: boolean;
}) {
  const requiredCerts = booking.requiredCertificates ?? [];

  return (
    <Card className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0 md:w-64 shrink-0">
        <div className="w-10 h-10 rounded-full bg-supplier-purple-start/20 text-supplier-purple-end font-semibold flex items-center justify-center shrink-0">
          {getInitials(booking.userName ?? "?")}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-body-text leading-snug truncate">{booking.userName}</p>
          <p className="text-xs text-muted-text">{booking.userTitle ?? booking.userEmail}</p>
          {requiredCerts.length > 0 && (
            <p className="text-xs font-medium text-amber mt-1">
              Requires: {requiredCerts.map((c) => c.certificateName).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 md:flex-1">
        <p className="font-medium text-body-text leading-snug truncate">{booking.listingName}</p>
        <p className="text-sm text-muted-text mt-0.5">{formatDateRange(booking.startDate, booking.endDate)}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-supplier-purple-end font-bold whitespace-nowrap">{booking.credits} cr</p>
        <StatusBadge status={booking.status} styles={BOOKING_STATUS_STYLES[booking.status]} />
        {booking.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              disabled={isMutating}
              onClick={() => onConfirm(booking.id)}
              className={`!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end h-9 px-4 text-sm ${
                isMutating ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              disabled={isMutating}
              onClick={() => onDecline(booking.id, booking.userName ?? "this requester")}
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
  const [activeFilter, setActiveFilter] = useState<FilterValue<BookingStatus>>("all");
  const [activeCertFilter, setActiveCertFilter] = useState<FilterValue<CertificateStatus>>("all");
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: bookings, isLoading: bookingsLoading } = useSupplierBookings();
  const { data: submittedCertificates, isLoading: certsLoading } = useSubmittedCertificates();
  const confirmBooking = useConfirmBooking();
  const declineBooking = useDeclineBooking();

  function handleConfirm(id: string) {
    setActionError(null);
    confirmBooking.mutate(id, {
      onError: (error) => {
        setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
  }

  function handleDeclineConfirm() {
    if (!declineTarget) return;
    setActionError(null);
    declineBooking.mutate(declineTarget.id, {
      onError: (error) => {
        setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
    setDeclineTarget(null);
  }

  const filteredBookings = (bookings ?? []).filter(
    (b) => activeFilter === "all" || b.status === activeFilter
  );

  const filteredCertRequests = (submittedCertificates ?? []).filter(
    (r) => activeCertFilter === "all" || r.status === activeCertFilter
  );

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

      {actionError && <p className="text-sm text-error-red mb-4">{actionError}</p>}

      {activeTab === "bookings" ? (
        bookingsLoading ? (
          <p className="text-sm text-muted-text text-center py-16">Loading bookings…</p>
        ) : (
          <>
            <FilterPills options={["all", ...BOOKING_STATUS_FILTERS]} active={activeFilter} onChange={setActiveFilter} />

            <div className="flex flex-col gap-4">
              {filteredBookings.length === 0 ? (
                <p className="text-sm text-muted-text text-center py-8">No bookings match the selected filter.</p>
              ) : (
                filteredBookings.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    onConfirm={handleConfirm}
                    onDecline={(id, name) => setDeclineTarget({ id, name })}
                    isMutating={
                      (confirmBooking.isPending && confirmBooking.variables === booking.id) ||
                      (declineBooking.isPending && declineBooking.variables === booking.id)
                    }
                  />
                ))
              )}
            </div>
          </>
        )
      ) : activeTab === "bulkOrders" ? (
        <Card>
          <h2 className="text-lg font-semibold text-body-text mb-2">Bulk Orders</h2>
          <p className="text-sm text-muted-text">
            Not wired yet — there&apos;s no supplier-facing GET endpoint to list bulk order requests, and
            no confirm/decline/fulfill routes exist for them (only the user-side{" "}
            <code>POST /api/bulk-order-requests</code> exists). Tracked as a backend gap.
          </p>
        </Card>
      ) : certsLoading ? (
        <p className="text-sm text-muted-text text-center py-16">Loading certificate requests…</p>
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
                {(submittedCertificates ?? []).length === 0
                  ? "No certificate requests submitted yet."
                  : "No certificate requests match the selected filter."}
              </p>
            ) : (
              filteredCertRequests.map((request) => (
                <Card key={request.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-body-text leading-snug">{request.name}</p>
                    <StatusBadge
                      status={request.status}
                      styles={CERTIFICATE_STATUS_STYLES[request.status as CertificateStatus]}
                    />
                  </div>
                  {request.category && <p className="text-sm text-muted-text">{request.category}</p>}
                </Card>
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

      <CertificateRequestModal open={certModalOpen} onClose={() => setCertModalOpen(false)} />
    </div>
  );
}
