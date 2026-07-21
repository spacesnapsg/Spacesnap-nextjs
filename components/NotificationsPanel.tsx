"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  CalendarCheck2,
  AlertTriangle,
  Wallet,
  Info,
  type LucideIcon,
} from "lucide-react";
import Card from "./Card";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/hooks/useNotifications";

const TYPE_META: Record<string, { icon: LucideIcon; color: string }> = {
  cert_earned: { icon: CheckCircle2, color: "text-success-green" },
  cert_expiry: { icon: AlertTriangle, color: "text-amber" },
  booking_confirmed: { icon: CalendarCheck2, color: "text-success-green" },
  credit_topup: { icon: Wallet, color: "text-success-green" },
  booking_credit_pending: { icon: AlertTriangle, color: "text-error-red" },
};

const DEFAULT_TYPE_META = { icon: Info, color: "text-muted-text" };

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationsPanelProps {
  /** Tailwind gradient stop classes, e.g. "from-user-teal-start to-user-teal-end" */
  accentGradient: string;
}

export default function NotificationsPanel({ accentGradient }: NotificationsPanelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const list = notifications ?? [];
  const unreadCount = list.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative text-muted-text hover:text-body-text transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-error-red text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <Card className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[360px] p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-body-text">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className={`text-xs font-medium bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent hover:opacity-80 transition-opacity`}
              >
                Mark all as read
              </button>
            )}
          </div>

          {list.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-6">You&apos;re all caught up.</p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-96 overflow-y-auto">
              {list.map((notification) => {
                const meta = TYPE_META[notification.type ?? ""] ?? DEFAULT_TYPE_META;
                const Icon = meta.icon;
                return (
                  <li
                    key={notification.id}
                    onClick={() => !notification.isRead && markRead.mutate(notification.id)}
                    className={`flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-background cursor-pointer ${
                      notification.pinned ? "bg-error-red/5 border border-error-red/20" : notification.isRead ? "" : "bg-background/60"
                    }`}
                  >
                    <Icon size={16} className={`mt-0.5 shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      {notification.title && (
                        <p
                          className={`text-sm leading-snug ${
                            notification.isRead && !notification.pinned ? "text-muted-text font-normal" : "text-body-text font-semibold"
                          }`}
                        >
                          {notification.title}
                        </p>
                      )}
                      <p
                        className={`text-sm leading-snug ${notification.isRead && !notification.pinned ? "text-muted-text" : "text-body-text"}`}
                      >
                        {notification.message}
                      </p>
                      <span className="text-xs text-hint-text">
                        {notification.pinned ? "Action needed" : formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    {!notification.isRead && !notification.pinned && (
                      <span className={`mt-1.5 h-2 w-2 rounded-full bg-gradient-to-r ${accentGradient} shrink-0`} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
