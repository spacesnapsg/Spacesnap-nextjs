"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, MapPin, Wallet, Package } from "lucide-react";
import Card from "@/components/Card";
import RatingStars from "@/components/RatingStars";
import RequestCancellationModal from "@/components/RequestCancellationModal";
import { useWallet } from "@/lib/hooks/useWallet";
import { useUserBookings, useSubmitRating, type UserBooking } from "@/lib/hooks/useUserBookings";
import {
  useMyBulkOrders,
  useCancelMyBulkOrder,
  useRequestBulkOrderCancellation,
  type MyBulkOrderRequest,
} from "@/lib/hooks/useMyBulkOrders";
import { ApiRequestError } from "@/lib/api-client";

const BOOKING_STATUS_STYLES: Record<UserBooking["status"], string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  active: "bg-success-green/15 text-success-green border-success-green/30",
  completed: "bg-muted-text/15 text-muted-text border-border",
  cancelled: "bg-red-400/15 text-red-400 border-red-400/30",
};

const BULK_ORDER_STATUS_STYLES: Record<MyBulkOrderRequest["status"], string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  confirmed: "bg-success-green/15 text-success-green border-success-green/30",
  fulfilled: "bg-muted-text/15 text-muted-text border-border",
  cancelled: "bg-red-400/15 text-red-400 border-red-400/30",
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function BookingActivityRow({ booking }: { booking: UserBooking }) {
  const submitRating = useSubmitRating();
  const [error, setError] = useState<string | null>(null);

  function handleRate(score: number) {
    setError(null);
    submitRating.mutate(
      { bookingId: booking.id, score },
      {
        onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong."),
      }
    );
  }

  const canRate = booking.status === "completed" && booking.listingType !== "consumables";

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-9 w-9 shrink-0 rounded-full bg-user-teal-start/15 text-user-teal-end flex items-center justify-center">
          <CalendarCheck size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-body-text font-medium truncate">{booking.listingName}</p>
          <p className="text-xs text-muted-text flex items-center gap-1">
            <MapPin size={11} />
            {formatDate(booking.startDate)}
            {booking.startDate !== booking.endDate ? ` – ${formatDate(booking.endDate)}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${BOOKING_STATUS_STYLES[booking.status]}`}
        >
          {booking.status}
        </span>
        {canRate &&
          (booking.rating ? (
            <RatingStars initialRating={booking.rating.score} size={14} readOnly />
          ) : (
            <div className="flex flex-col items-end gap-0.5">
              <p className="text-xs text-muted-text">Rate this session</p>
              <RatingStars onRate={handleRate} size={14} />
              {error && <p className="text-xs text-error-red">{error}</p>}
            </div>
          ))}
      </div>
    </div>
  );
}

function BulkOrderActivityRow({
  request,
  onCancel,
  onRequestCancellation,
  isMutating,
}: {
  request: MyBulkOrderRequest;
  onCancel: (id: string) => void;
  onRequestCancellation: (id: string, listingName: string | undefined) => void;
  isMutating: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-9 w-9 shrink-0 rounded-full bg-user-teal-start/15 text-user-teal-end flex items-center justify-center">
          <Package size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-body-text font-medium truncate">{request.listingName}</p>
          <p className="text-xs text-muted-text">
            {request.quantity} unit(s) &middot; {request.credits} cr
          </p>
          {request.estimatedDeliveryDate && (
            <p className="text-xs text-muted-text">Est. delivery week of {formatDate(request.estimatedDeliveryDate)}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${BULK_ORDER_STATUS_STYLES[request.status]}`}
        >
          {request.status}
        </span>
        {request.status === "pending" && (
          <button
            type="button"
            disabled={isMutating}
            onClick={() => onCancel(request.id)}
            className={`text-xs text-error-red hover:underline ${isMutating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Cancel
          </button>
        )}
        {request.status === "confirmed" &&
          (request.cancellationRequestedAt ? (
            <p className="text-xs text-amber">Cancellation requested</p>
          ) : (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onRequestCancellation(request.id, request.listingName)}
              className={`text-xs text-error-red hover:underline ${isMutating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Request Cancellation
            </button>
          ))}
      </div>
    </div>
  );
}

export default function UserDashboardPage() {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: bookings, isLoading: bookingsLoading } = useUserBookings();
  const { data: bulkOrders, isLoading: bulkOrdersLoading } = useMyBulkOrders();
  const cancelBulkOrder = useCancelMyBulkOrder();
  const requestCancellation = useRequestBulkOrderCancellation();
  const [cancellationTarget, setCancellationTarget] = useState<{ id: string; listingName?: string } | null>(null);
  const [cancellationError, setCancellationError] = useState<string | null>(null);

  function handleCancelPending(id: string) {
    setCancellationError(null);
    cancelBulkOrder.mutate(id, {
      onError: (error) => {
        setCancellationError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
  }

  function handleRequestCancellationSubmit(reason: string) {
    if (!cancellationTarget) return;
    setCancellationError(null);
    requestCancellation.mutate(
      { id: cancellationTarget.id, reason },
      {
        onSuccess: () => setCancellationTarget(null),
        onError: (error) => {
          setCancellationError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
        },
      }
    );
  }

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
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <p className="text-muted-text text-sm">Credit Balance</p>
            <p className="text-2xl font-semibold text-body-text mt-1">
              {walletLoading ? "…" : `${wallet?.balance ?? 0} cr`}
            </p>
            <Link href="/wallet" className="text-xs text-user-teal-end hover:underline mt-2 inline-block">
              View Wallet
            </Link>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-user-teal-start to-user-teal-end flex items-center justify-center">
            <CalendarCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-muted-text text-sm">Total Bookings</p>
            <p className="text-2xl font-semibold text-body-text mt-1">
              {bookingsLoading ? "…" : (bookings?.length ?? 0)}
            </p>
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-body-text mb-2">Currently Active</h2>
        <p className="text-sm text-muted-text">
          Not wired yet — there&apos;s no GET endpoint to list active check-ins (only POST create and
          PATCH check-out exist). Tracked as a backend gap.
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-body-text mb-2">Recent Activity</h2>
        <p className="text-sm text-muted-text mb-2">
          Your recent bookings — rate a space or equipment once its booking is completed.
        </p>
        {bookingsLoading ? (
          <p className="text-sm text-muted-text py-4">Loading…</p>
        ) : !bookings || bookings.length === 0 ? (
          <p className="text-sm text-muted-text py-4">No bookings yet.</p>
        ) : (
          <div className="flex flex-col">
            {bookings.map((booking) => (
              <BookingActivityRow key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-body-text mb-2">Bulk Orders</h2>
        <p className="text-sm text-muted-text mb-2">
          Requests to suppliers for consumables. Pending requests can be cancelled directly; once a supplier
          confirms, cancelling needs their review.
        </p>
        {cancellationError && <p className="text-sm text-error-red mb-2">{cancellationError}</p>}
        {bulkOrdersLoading ? (
          <p className="text-sm text-muted-text py-4">Loading…</p>
        ) : !bulkOrders || bulkOrders.length === 0 ? (
          <p className="text-sm text-muted-text py-4">No bulk orders yet.</p>
        ) : (
          <div className="flex flex-col">
            {bulkOrders.map((request) => (
              <BulkOrderActivityRow
                key={request.id}
                request={request}
                onCancel={handleCancelPending}
                onRequestCancellation={(id, listingName) => setCancellationTarget({ id, listingName })}
                isMutating={
                  (cancelBulkOrder.isPending && cancelBulkOrder.variables === request.id) ||
                  (requestCancellation.isPending && requestCancellation.variables?.id === request.id)
                }
              />
            ))}
          </div>
        )}
      </Card>

      <RequestCancellationModal
        open={!!cancellationTarget}
        onClose={() => {
          setCancellationTarget(null);
          setCancellationError(null);
        }}
        onConfirm={handleRequestCancellationSubmit}
        listingName={cancellationTarget?.listingName}
        isSubmitting={requestCancellation.isPending}
        errorMessage={cancellationError}
      />
    </div>
  );
}
