"use client";

import { useState } from "react";
import {
  UserPlus,
  Building2,
  CalendarCheck2,
  Award,
  ListPlus,
  ShoppingBag,
  Wallet,
  RotateCcw,
  Check,
  CheckCheck,
  Archive,
  ArchiveRestore,
  Bell,
  type LucideIcon,
} from "lucide-react";
import Card from "@/components/Card";
import Pagination from "@/components/Pagination";
import {
  useAdminNotifications,
  useSetAdminNotificationRead,
  useSetAdminNotificationArchived,
  useMarkAllAdminNotificationsRead,
  useArchiveAllAdminNotifications,
  type AdminNotification,
  type AdminNotificationType,
} from "@/lib/hooks/useAdminNotifications";

const TYPE_META: Record<AdminNotificationType, { icon: LucideIcon; color: string }> = {
  new_user: { icon: UserPlus, color: "text-user-teal-end" },
  new_supplier: { icon: Building2, color: "text-supplier-purple-start" },
  new_booking: { icon: CalendarCheck2, color: "text-success-green" },
  new_credential: { icon: Award, color: "text-amber" },
  new_listing: { icon: ListPlus, color: "text-supplier-purple-start" },
  new_purchase: { icon: ShoppingBag, color: "text-success-green" },
  wallet_topup: { icon: Wallet, color: "text-user-teal-end" },
  refund: { icon: RotateCcw, color: "text-error-red" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationRow({ notification, view }: { notification: AdminNotification; view: "active" | "archived" }) {
  const meta = TYPE_META[notification.type] ?? { icon: Bell, color: "text-muted-text" };
  const Icon = meta.icon;
  const setRead = useSetAdminNotificationRead();
  const setArchived = useSetAdminNotificationArchived();
  const unread = !notification.isRead;

  return (
    <li
      className={`flex items-start gap-3 rounded-lg px-4 py-3 transition-colors ${
        unread ? "bg-admin-red-start/5 border border-admin-red-start/15" : "border border-transparent"
      }`}
    >
      <span className={`mt-0.5 h-9 w-9 shrink-0 rounded-full bg-background flex items-center justify-center ${meta.color}`}>
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${unread ? "text-body-text font-semibold" : "text-muted-text font-normal"}`}>
          {notification.title}
        </p>
        <p className={`text-sm leading-snug ${unread ? "text-body-text" : "text-muted-text"}`}>{notification.message}</p>
        <span className="text-xs text-hint-text">{formatDate(notification.createdAt)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setRead.mutate({ id: notification.id, isRead: !notification.isRead })}
          disabled={setRead.isPending}
          aria-label={notification.isRead ? "Mark as unread" : "Mark as read"}
          title={notification.isRead ? "Mark as unread" : "Mark as read"}
          className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${
            notification.isRead ? "text-success-green" : "text-muted-text hover:text-body-text"
          }`}
        >
          <Check size={16} />
        </button>
        <button
          type="button"
          onClick={() => setArchived.mutate({ id: notification.id, isArchived: view === "active" })}
          disabled={setArchived.isPending}
          aria-label={view === "active" ? "Archive" : "Restore to Active"}
          title={view === "active" ? "Archive" : "Restore to Active"}
          className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-body-text transition-colors"
        >
          {view === "active" ? <Archive size={16} /> : <ArchiveRestore size={16} />}
        </button>
      </div>
    </li>
  );
}

export default function AdminNotificationsPage() {
  const [view, setView] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminNotifications(view, page);
  const markAllRead = useMarkAllAdminNotificationsRead();
  const archiveAll = useArchiveAllAdminNotifications();

  function changeView(next: "active" | "archived") {
    setView(next);
    setPage(1);
  }

  const hasActiveNotifications = view === "active" && !!data && data.notifications.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Notifications
        </h1>
        <p className="text-muted-text mt-1">
          New members, new suppliers, new bookings, and newly earned credentials across the platform.
        </p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-6 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeView("active")}
              className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                view === "active"
                  ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white"
                  : "text-muted-text hover:text-body-text"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => changeView("archived")}
              className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                view === "archived"
                  ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white"
                  : "text-muted-text hover:text-body-text"
              }`}
            >
              Archived
            </button>
          </div>

          {hasActiveNotifications && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-text hover:text-body-text transition-colors disabled:opacity-50"
              >
                <CheckCheck size={14} />
                Mark all as read
              </button>
              <button
                type="button"
                onClick={() => archiveAll.mutate(undefined, { onSuccess: () => setPage(1) })}
                disabled={archiveAll.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-text hover:text-body-text transition-colors disabled:opacity-50"
              >
                <Archive size={14} />
                Archive all
              </button>
            </div>
          )}
        </div>

        <div className="px-3 pb-3">
          {isLoading || !data ? (
            <p className="text-sm text-muted-text text-center py-12">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-error-red text-center py-12">Failed to load notifications.</p>
          ) : data.notifications.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-12">
              {view === "active" ? "You're all caught up." : "No archived notifications."}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {data.notifications.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} view={view} />
                ))}
              </ul>
              <div className="px-3">
                <Pagination page={data.meta.page} pageSize={data.meta.perPage} total={data.meta.total} onPageChange={setPage} />
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
