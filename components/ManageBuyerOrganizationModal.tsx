"use client";

import { useState } from "react";
import { UserMinus, ShieldCheck, Check, X as XIcon, CalendarClock, Activity, Coins } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Pagination from "@/components/Pagination";
import DateRangePicker from "@/components/DateRangePicker";
import { ApiRequestError } from "@/lib/api-client";
import {
  useBuyerOrgMembers,
  useRemoveBuyerOrgMember,
  usePromoteBuyerOrgMember,
  useBuyerOrgJoinRequests,
  useResolveBuyerOrgJoinRequest,
  useBuyerOrgStats,
  useBuyerOrgActivity,
  useBuyerOrgTransactions,
} from "@/lib/hooks/useBuyerOrganization";
import { useDateRangeFilter } from "@/lib/hooks/useDateRangeFilter";

type Tab = "overview" | "members" | "requests";

interface ManageBuyerOrganizationModalProps {
  open: boolean;
  onClose: () => void;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatActionType(actionType: string) {
  return actionType.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded p-3 text-center">
      <p className="text-2xl font-semibold text-body-text">{value}</p>
      <p className="text-xs text-muted-text mt-0.5">{label}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CalendarClock;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-body-text mb-2">
        <Icon size={14} className="text-user-teal-end" />
        {title}
      </h3>
      {children}
    </div>
  );
}

// Org-admin membership management — mirrors the shape of the admin
// concierge-review modals (app/(admin)/admin/dashboard/page.tsx) but scoped
// to a single organization's own admin rather than a system admin. Overview
// tab aggregates each member's own bookings/activity/ledger rows (not the
// shared purchased-credit pool — that has no spend write-path yet, see
// getBuyerOrgStats's comment in lib/buyer-organizations.ts).
export default function ManageBuyerOrganizationModal({ open, onClose }: ManageBuyerOrganizationModalProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useBuyerOrgStats(open);
  const { data: members } = useBuyerOrgMembers();
  const removeMember = useRemoveBuyerOrgMember();
  const promoteMember = usePromoteBuyerOrgMember();
  const { data: requests } = useBuyerOrgJoinRequests();
  const resolveRequest = useResolveBuyerOrgJoinRequest();

  const activityRange = useDateRangeFilter("all");
  const { data: activityData, isLoading: activityLoading } = useBuyerOrgActivity(
    open,
    { from: activityRange.from, to: activityRange.to },
    activityRange.page
  );

  const transactionsRange = useDateRangeFilter("all");
  const { data: transactionsData, isLoading: transactionsLoading } = useBuyerOrgTransactions(
    open,
    { from: transactionsRange.from, to: transactionsRange.to },
    transactionsRange.page
  );

  function handleError(err: unknown) {
    setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
  }

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[640px]">
      <h2 className="text-xl font-semibold text-body-text mb-4">Manage Organization</h2>

      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "overview" ? "border-user-teal-end text-body-text" : "border-transparent text-muted-text"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "members" ? "border-user-teal-end text-body-text" : "border-transparent text-muted-text"
          }`}
        >
          Members
        </button>
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "requests" ? "border-user-teal-end text-body-text" : "border-transparent text-muted-text"
          }`}
        >
          Join Requests
          {requests && requests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-user-teal-end text-white text-[10px] font-semibold">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-error-red mb-4">{error}</p>}

      {tab === "overview" && (
        <div className="flex flex-col gap-5 max-h-[65vh] overflow-y-auto pr-1">
          {statsLoading || !stats ? (
            <p className="text-sm text-muted-text text-center py-8">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Members" value={stats.memberCount} />
                <StatTile label="Total Bookings" value={stats.totalBookings} />
                <StatTile label="Upcoming Bookings" value={stats.upcomingBookingsCount} />
              </div>

              <Section icon={CalendarClock} title="Upcoming Bookings">
                {stats.upcomingBookings.length === 0 ? (
                  <p className="text-sm text-muted-text py-2">No upcoming bookings.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {stats.upcomingBookings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between border border-border rounded p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-body-text font-medium truncate">{b.listingName}</p>
                          <p className="text-xs text-muted-text">
                            {b.userName} · {formatDate(b.startDate)} – {formatDate(b.endDate)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-user-teal-end bg-user-teal-end/10 rounded-full px-2 py-0.5">
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section icon={Activity} title="Recent Activity">
                <div className="mb-3">
                  <DateRangePicker
                    preset={activityRange.preset}
                    from={activityRange.from}
                    to={activityRange.to}
                    onPresetChange={activityRange.changePreset}
                    onFromChange={activityRange.changeFrom}
                    onToChange={activityRange.changeTo}
                  />
                </div>

                {activityLoading && !activityData ? (
                  <p className="text-sm text-muted-text py-2">Loading…</p>
                ) : !activityData || activityData.activity.length === 0 ? (
                  <p className="text-sm text-muted-text py-2">
                    No activity {activityRange.from || activityRange.to ? "in the selected date range" : "yet"}.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col max-h-56 overflow-y-auto">
                      {activityData.activity.map((entry) => (
                        <div key={entry.id} className="py-2 border-b border-border/40 last:border-0">
                          <p className="text-sm text-body-text">
                            <span className="font-medium">{entry.userName}</span> — {entry.description}
                          </p>
                          <p className="text-xs text-muted-text mt-0.5">
                            {formatActionType(entry.actionType)} · {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Pagination
                      page={activityRange.page}
                      pageSize={activityData.meta.pageSize}
                      total={activityData.meta.total}
                      onPageChange={activityRange.setPage}
                    />
                  </>
                )}
              </Section>

              <Section icon={Coins} title="Credit Movement">
                <div className="mb-3">
                  <DateRangePicker
                    preset={transactionsRange.preset}
                    from={transactionsRange.from}
                    to={transactionsRange.to}
                    onPresetChange={transactionsRange.changePreset}
                    onFromChange={transactionsRange.changeFrom}
                    onToChange={transactionsRange.changeTo}
                  />
                </div>

                {transactionsLoading && !transactionsData ? (
                  <p className="text-sm text-muted-text py-2">Loading…</p>
                ) : !transactionsData || transactionsData.transactions.length === 0 ? (
                  <p className="text-sm text-muted-text py-2">
                    No credit movement {transactionsRange.from || transactionsRange.to ? "in the selected date range" : "yet"}.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col max-h-56 overflow-y-auto">
                      {transactionsData.transactions.map((t) => {
                        const isCredit = t.amount >= 0;
                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-body-text truncate">
                                <span className="font-medium">{t.userName}</span> — {t.description}
                              </p>
                              <p className="text-xs text-muted-text">{formatDateTime(t.createdAt)}</p>
                            </div>
                            <p
                              className={`text-sm font-medium shrink-0 ${
                                isCredit ? "text-success-green" : "text-red-400"
                              }`}
                            >
                              {isCredit ? "+" : "-"}
                              {Math.abs(t.amount)} credits
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <Pagination
                      page={transactionsRange.page}
                      pageSize={transactionsData.meta.pageSize}
                      total={transactionsData.meta.total}
                      onPageChange={transactionsRange.setPage}
                    />
                  </>
                )}
              </Section>
            </>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="flex flex-col gap-3">
          {!members || members.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">No members yet.</p>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between border border-border rounded p-3">
                <div>
                  <p className="text-sm font-medium text-body-text">
                    {member.name}
                    {member.isBuyerOrgAdmin && (
                      <span className="ml-2 text-xs text-user-teal-end font-semibold">Admin</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-text">{member.email}</p>
                </div>
                {!member.isBuyerOrgAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Promote to admin"
                      disabled={promoteMember.isPending}
                      onClick={() => {
                        setError(null);
                        promoteMember.mutate(member.id, { onError: handleError });
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-user-teal-end transition-colors"
                    >
                      <ShieldCheck size={16} />
                    </button>
                    <button
                      type="button"
                      title="Remove member"
                      disabled={removeMember.isPending}
                      onClick={() => {
                        setError(null);
                        removeMember.mutate(member.id, { onError: handleError });
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-error-red transition-colors"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="flex flex-col gap-3">
          {!requests || requests.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">No pending join requests.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between border border-border rounded p-3">
                <div>
                  <p className="text-sm font-medium text-body-text">{request.requestedBy.name}</p>
                  <p className="text-xs text-muted-text">{request.requestedBy.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={resolveRequest.isPending}
                    onClick={() => {
                      setError(null);
                      resolveRequest.mutate(
                        { id: request.id, status: "approved" },
                        { onError: handleError }
                      );
                    }}
                    className="h-8 px-3 text-xs gap-1"
                  >
                    <Check size={14} /> Approve
                  </Button>
                  <button
                    type="button"
                    disabled={resolveRequest.isPending}
                    onClick={() => {
                      setError(null);
                      resolveRequest.mutate(
                        { id: request.id, status: "rejected" },
                        { onError: handleError }
                      );
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-error-red transition-colors"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
