"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CalendarCheck2,
  AlertTriangle,
  Wallet,
  Info,
  Check,
  CheckCheck,
  Archive,
  ArchiveRestore,
  type LucideIcon,
} from "lucide-react";
import Card from "@/components/Card";
import Pagination from "@/components/Pagination";
import {
  useNotificationsPage,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useArchiveNotification,
  type Notification,
} from "@/lib/hooks/useNotifications";

const TYPE_META: Record<string, { icon: LucideIcon; color: string }> = {
  cert_earned: { icon: CheckCircle2, color: "text-success-green" },
  cert_expiry: { icon: AlertTriangle, color: "text-amber" },
  booking_confirmed: { icon: CalendarCheck2, color: "text-success-green" },
  credit_topup: { icon: Wallet, color: "text-success-green" },
  booking_credit_pending: { icon: AlertTriangle, color: "text-error-red" },
};
const DEFAULT_TYPE_META = { icon: Info, color: "text-muted-text" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationRow({ notification, view }: { notification: Notification; view: "active" | "archived" }) {
  const meta = TYPE_META[notification.type ?? ""] ?? DEFAULT_TYPE_META;
  const Icon = meta.icon;
  const markRead = useMarkNotificationRead();
  const archive = useArchiveNotification();
  const unread = !notification.isRead;

  return (
    <li
      className={`flex items-start gap-3 rounded-lg px-4 py-3 transition-colors ${
        notification.pinned
          ? "bg-error-red/5 border border-error-red/20"
          : unread
            ? "bg-background/60 border border-transparent"
            : "border border-transparent"
      }`}
    >
      <span className={`mt-0.5 h-9 w-9 shrink-0 rounded-full bg-background flex items-center justify-center ${meta.color}`}>
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        {notification.title && (
          <p className={`text-sm leading-snug ${unread ? "text-body-text font-semibold" : "text-muted-text font-normal"}`}>
            {notification.title}
          </p>
        )}
        <p className={`text-sm leading-snug ${unread ? "text-body-text" : "text-muted-text"}`}>{notification.message}</p>
        <span className="text-xs text-hint-text">
          {notification.pinned ? "Action needed" : formatDate(notification.createdAt)}
        </span>
      </div>
      {!notification.pinned && (
        <div className="flex items-center gap-1 shrink-0">
          {unread && (
            <button
              type="button"
              onClick={() => markRead.mutate(notification.id)}
              disabled={markRead.isPending}
              aria-label="Mark as read"
              title="Mark as read"
              className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-body-text transition-colors"
            >
              <Check size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => archive.mutate({ id: notification.id, isArchived: view === "active" })}
            disabled={archive.isPending}
            aria-label={view === "active" ? "Archive" : "Restore to Active"}
            title={view === "active" ? "Archive" : "Restore to Active"}
            className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-body-text transition-colors"
          >
            {view === "active" ? <Archive size={16} /> : <ArchiveRestore size={16} />}
          </button>
        </div>
      )}
    </li>
  );
}

interface NotificationsPageContentProps {
  /** Tailwind gradient stop classes, e.g. "from-user-teal-start to-user-teal-end" */
  accentGradient: string;
}

// Shared by app/(user)/notifications and app/(supplier)/supplier-notifications
// — same personal-Notification feed either way, just themed per role. Mirrors
// the admin Notifications page's Active/Archived + pagination shape.
export default function NotificationsPageContent({ accentGradient }: NotificationsPageContentProps) {
  const [view, setView] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useNotificationsPage(view, page);
  const markAllRead = useMarkAllNotificationsRead();

  function changeView(next: "active" | "archived") {
    setView(next);
    setPage(1);
  }

  const hasUnread = view === "active" && !!data && data.notifications.some((n) => !n.isRead);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className={`text-3xl sm:text-4xl font-extrabold bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}>
          Notifications
        </h1>
        <p className="text-muted-text mt-1">Everything personal to your account, in one place.</p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-6 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeView("active")}
              className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                view === "active" ? `bg-gradient-to-r ${accentGradient} text-white` : "text-muted-text hover:text-body-text"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => changeView("archived")}
              className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                view === "archived" ? `bg-gradient-to-r ${accentGradient} text-white` : "text-muted-text hover:text-body-text"
              }`}
            >
              Archived
            </button>
          </div>

          {hasUnread && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-text hover:text-body-text transition-colors disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark all as read
            </button>
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
