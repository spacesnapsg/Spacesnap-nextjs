"use client";

import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import DeclineReasonModal from "@/components/DeclineReasonModal";
import CertificateRequestModal from "@/components/CertificateRequestModal";
import ConfirmBulkOrderModal from "@/components/ConfirmBulkOrderModal";
import CancellationReviewModal from "@/components/CancellationReviewModal";
import {
  useSupplierBookings,
  useConfirmBooking,
  useDeclineBooking,
  type SupplierBooking,
  type BookingStatus,
} from "@/lib/hooks/useSupplierBookings";
import {
  useSupplierBulkOrders,
  useConfirmBulkOrder,
  useDeclineBulkOrder,
  useFulfillBulkOrder,
  useApproveBulkOrderCancellation,
  useRejectBulkOrderCancellation,
  type SupplierBulkOrderRequest,
  type BulkOrderStatus,
} from "@/lib/hooks/useSupplierBulkOrders";
import { useSubmittedCertificates } from "@/lib/hooks/useSupplierCertificates";
import { ApiRequestError } from "@/lib/api-client";

type Tab = "bookings" | "bulkOrders" | "certificates";

const TABS: { id: Tab; label: string }[] = [
  { id: "bookings", label: "Bookings" },
  { id: "bulkOrders", label: "Bulk Orders" },
  { id: "certificates", label: "Certificate Requests" },
];

const BOOKING_STATUS_FILTERS: BookingStatus[] = ["pending", "confirmed", "active", "completed", "cancelled"];
const BULK_ORDER_STATUS_FILTERS: BulkOrderStatus[] = ["pending", "confirmed", "fulfilled", "cancelled"];
const CERTIFICATE_STATUS_FILTERS = ["pending", "approved", "rejected"] as const;
type CertificateStatus = (typeof CERTIFICATE_STATUS_FILTERS)[number];

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  active: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  completed: "bg-white/10 text-body-text border-white/20",
  cancelled: "bg-error-red/15 text-error-red border-error-red/30",
};

const BULK_ORDER_STATUS_STYLES: Record<BulkOrderStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  fulfilled: "bg-white/10 text-body-text border-white/20",
  cancelled: "bg-error-red/15 text-error-red border-error-red/30",
};

const CERTIFICATE_STATUS_STYLES: Record<CertificateStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  approved: "bg-success-green/15 text-success-green border-success-green/30",
  rejected: "bg-error-red/15 text-error-red border-error-red/30",
};

type DeclineTarget = { id: string; name: string };
type CancellationReviewTarget = { id: string; name: string; reason: string | null };
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

function formatDeliveryDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function BulkOrderRow({
  request,
  onConfirmClick,
  onDecline,
  onFulfill,
  onReviewCancellation,
  isMutating,
}: {
  request: SupplierBulkOrderRequest;
  onConfirmClick: (id: string, name: string) => void;
  onDecline: (id: string, name: string) => void;
  onFulfill: (id: string) => void;
  onReviewCancellation: (id: string, name: string, reason: string | null) => void;
  isMutating: boolean;
}) {
  const hasCancellationRequest = !!request.cancellationRequestedAt;

  return (
    <Card className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0 md:w-64 shrink-0">
        <div className="w-10 h-10 rounded-full bg-supplier-purple-start/20 text-supplier-purple-end font-semibold flex items-center justify-center shrink-0">
          {getInitials(request.userName ?? "?")}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-body-text leading-snug truncate">{request.userName ?? "Unknown requester"}</p>
          <p className="text-xs text-muted-text">{request.userEmail}</p>
        </div>
      </div>

      <div className="min-w-0 md:flex-1">
        <p className="font-medium text-body-text leading-snug truncate">{request.listingName}</p>
        <p className="text-sm text-muted-text mt-0.5">{request.quantity} unit(s)</p>
        {request.estimatedDeliveryDate && (
          <p className="text-xs text-muted-text mt-0.5">
            Est. delivery week of {formatDeliveryDate(request.estimatedDeliveryDate)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-supplier-purple-end font-bold whitespace-nowrap">{request.credits} cr</p>
        {hasCancellationRequest && (
          <button
            type="button"
            title="Buyer requested cancellation — click to review"
            onClick={() => onReviewCancellation(request.id, request.userName ?? "this requester", request.cancellationReason)}
            className="text-amber hover:text-amber/80 transition-colors"
          >
            <AlertTriangle size={18} />
          </button>
        )}
        <StatusBadge status={request.status} styles={BULK_ORDER_STATUS_STYLES[request.status]} />
        {(request.status === "pending" || request.status === "confirmed") && (
          <div className="flex items-center gap-2">
            {request.status === "pending" && (
              <Button
                disabled={isMutating}
                onClick={() => onConfirmClick(request.id, request.userName ?? "this requester")}
                className={`!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end h-9 px-4 text-sm ${
                  isMutating ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Confirm
              </Button>
            )}
            <Button
              variant={request.status === "confirmed" ? "primary" : "ghost"}
              disabled={isMutating || request.status !== "confirmed"}
              onClick={() => onFulfill(request.id)}
              title={request.status !== "confirmed" ? "Confirm the request before fulfilling it." : undefined}
              className={
                request.status === "confirmed"
                  ? `!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end h-9 px-4 text-sm ${
                      isMutating ? "opacity-50 cursor-not-allowed" : ""
                    }`
                  : "h-9 px-4 text-sm opacity-60 cursor-not-allowed"
              }
            >
              Fulfill
            </Button>
            <Button
              variant="ghost"
              disabled={isMutating}
              onClick={() => onDecline(request.id, request.userName ?? "this requester")}
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
  const [activeBulkOrderFilter, setActiveBulkOrderFilter] = useState<FilterValue<BulkOrderStatus>>("all");
  const [activeCertFilter, setActiveCertFilter] = useState<FilterValue<CertificateStatus>>("all");
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null);
  const [declineBulkOrderTarget, setDeclineBulkOrderTarget] = useState<DeclineTarget | null>(null);
  const [confirmBulkOrderTarget, setConfirmBulkOrderTarget] = useState<DeclineTarget | null>(null);
  const [confirmBulkOrderError, setConfirmBulkOrderError] = useState<string | null>(null);
  const [cancellationReviewTarget, setCancellationReviewTarget] = useState<CancellationReviewTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: bookings, isLoading: bookingsLoading } = useSupplierBookings();
  const { data: bulkOrders, isLoading: bulkOrdersLoading } = useSupplierBulkOrders();
  const { data: submittedCertificates, isLoading: certsLoading } = useSubmittedCertificates();
  const confirmBooking = useConfirmBooking();
  const declineBooking = useDeclineBooking();
  const confirmBulkOrder = useConfirmBulkOrder();
  const declineBulkOrder = useDeclineBulkOrder();
  const fulfillBulkOrder = useFulfillBulkOrder();
  const approveCancellation = useApproveBulkOrderCancellation();
  const rejectCancellation = useRejectBulkOrderCancellation();

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

  function handleConfirmBulkOrderSubmit(estimatedDeliveryDate: string) {
    if (!confirmBulkOrderTarget) return;
    setConfirmBulkOrderError(null);
    confirmBulkOrder.mutate(
      { id: confirmBulkOrderTarget.id, estimatedDeliveryDate },
      {
        onSuccess: () => setConfirmBulkOrderTarget(null),
        onError: (error) => {
          setConfirmBulkOrderError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
        },
      }
    );
  }

  function handleFulfillBulkOrder(id: string) {
    setActionError(null);
    fulfillBulkOrder.mutate(id, {
      onError: (error) => {
        setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
  }

  function handleDeclineBulkOrderConfirm() {
    if (!declineBulkOrderTarget) return;
    setActionError(null);
    declineBulkOrder.mutate(declineBulkOrderTarget.id, {
      onError: (error) => {
        setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
    setDeclineBulkOrderTarget(null);
  }

  function handleApproveCancellation() {
    if (!cancellationReviewTarget) return;
    setActionError(null);
    approveCancellation.mutate(cancellationReviewTarget.id, {
      onSuccess: () => setCancellationReviewTarget(null),
      onError: (error) => {
        setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
  }

  function handleRejectCancellation() {
    if (!cancellationReviewTarget) return;
    setActionError(null);
    rejectCancellation.mutate(cancellationReviewTarget.id, {
      onSuccess: () => setCancellationReviewTarget(null),
      onError: (error) => {
        setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
  }

  const filteredBookings = (bookings ?? []).filter(
    (b) => activeFilter === "all" || b.status === activeFilter
  );

  const filteredBulkOrders = (bulkOrders ?? []).filter(
    (r) => activeBulkOrderFilter === "all" || r.status === activeBulkOrderFilter
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
        bulkOrdersLoading ? (
          <p className="text-sm text-muted-text text-center py-16">Loading bulk orders…</p>
        ) : (
          <>
            <FilterPills
              options={["all", ...BULK_ORDER_STATUS_FILTERS]}
              active={activeBulkOrderFilter}
              onChange={setActiveBulkOrderFilter}
            />

            <div className="flex flex-col gap-4">
              {filteredBulkOrders.length === 0 ? (
                <p className="text-sm text-muted-text text-center py-8">No bulk orders match the selected filter.</p>
              ) : (
                filteredBulkOrders.map((request) => (
                  <BulkOrderRow
                    key={request.id}
                    request={request}
                    onConfirmClick={(id, name) => setConfirmBulkOrderTarget({ id, name })}
                    onDecline={(id, name) => setDeclineBulkOrderTarget({ id, name })}
                    onFulfill={handleFulfillBulkOrder}
                    onReviewCancellation={(id, name, reason) => setCancellationReviewTarget({ id, name, reason })}
                    isMutating={
                      (confirmBulkOrder.isPending && confirmBulkOrder.variables?.id === request.id) ||
                      (declineBulkOrder.isPending && declineBulkOrder.variables === request.id) ||
                      (fulfillBulkOrder.isPending && fulfillBulkOrder.variables === request.id) ||
                      (approveCancellation.isPending && approveCancellation.variables === request.id) ||
                      (rejectCancellation.isPending && rejectCancellation.variables === request.id)
                    }
                  />
                ))
              )}
            </div>
          </>
        )
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

      <DeclineReasonModal
        open={!!declineBulkOrderTarget}
        onClose={() => setDeclineBulkOrderTarget(null)}
        onConfirm={handleDeclineBulkOrderConfirm}
        requestName={declineBulkOrderTarget?.name}
      />

      <ConfirmBulkOrderModal
        open={!!confirmBulkOrderTarget}
        onClose={() => {
          setConfirmBulkOrderTarget(null);
          setConfirmBulkOrderError(null);
        }}
        onConfirm={handleConfirmBulkOrderSubmit}
        requestName={confirmBulkOrderTarget?.name}
        isSubmitting={confirmBulkOrder.isPending}
        errorMessage={confirmBulkOrderError}
      />

      <CancellationReviewModal
        open={!!cancellationReviewTarget}
        onClose={() => setCancellationReviewTarget(null)}
        onApprove={handleApproveCancellation}
        onReject={handleRejectCancellation}
        requestName={cancellationReviewTarget?.name}
        reason={cancellationReviewTarget?.reason}
        isSubmitting={approveCancellation.isPending || rejectCancellation.isPending}
      />

      <CertificateRequestModal open={certModalOpen} onClose={() => setCertModalOpen(false)} />
    </div>
  );
}
