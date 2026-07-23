"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  CalendarCheck2,
  AlertTriangle,
  Wallet,
  Info,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import Card from "./Card";
import AnnouncementModal from "./AnnouncementModal";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, type Notification } from "@/lib/hooks/useNotifications";
import {
  useAnnouncements,
  useMarkAnnouncementRead,
  useMarkAllAnnouncementsRead,
  type Announcement,
} from "@/lib/hooks/useAnnouncements";

const TYPE_META: Record<string, { icon: LucideIcon; color: string }> = {
  cert_earned: { icon: CheckCircle2, color: "text-success-green" },
  cert_expiry: { icon: AlertTriangle, color: "text-amber" },
  booking_confirmed: { icon: CalendarCheck2, color: "text-success-green" },
  credit_topup: { icon: Wallet, color: "text-success-green" },
  booking_credit_pending: { icon: AlertTriangle, color: "text-error-red" },
};

const DEFAULT_TYPE_META = { icon: Info, color: "text-muted-text" };
const ANNOUNCEMENT_META = { icon: Megaphone, color: "text-user-teal-end" };

// Sprint 6.12 — merges the flat per-user Notification feed with the
// Announcement broadcast feed into one client-side list. Announcements
// never carry `pinned` (that concept only exists for Notification today),
// so they sort purely by recency among themselves and never jump ahead of
// a pinned booking_credit_pending row — mirrors getNotifications' own
// `pinned desc, createdAt desc` ordering, just computed here since the two
// feeds come from separate queries.
type FeedItem =
  | { kind: "notification"; id: string; isRead: boolean; pinned: boolean; createdAt: string; data: Notification }
  | { kind: "announcement"; id: string; isRead: boolean; pinned: false; createdAt: string; data: Announcement };

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
  const [openAnnouncement, setOpenAnnouncement] = useState<Announcement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: notifications } = useNotifications();
  const { data: announcements } = useAnnouncements();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const markAnnouncementRead = useMarkAnnouncementRead();
  const markAllAnnouncementsRead = useMarkAllAnnouncementsRead();

  const feed: FeedItem[] = [
    ...(notifications ?? []).map(
      (n): FeedItem => ({ kind: "notification", id: n.id, isRead: n.isRead, pinned: n.pinned, createdAt: n.createdAt, data: n })
    ),
    ...(announcements ?? []).map(
      (a): FeedItem => ({ kind: "announcement", id: a.id, isRead: a.isRead, pinned: false, createdAt: a.createdAt, data: a })
    ),
  ].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const unreadCount = feed.filter((item) => !item.isRead).length;

  function handleItemClick(item: FeedItem) {
    if (item.kind === "notification") {
      if (!item.isRead) markRead.mutate(item.id);
      return;
    }
    setOpenAnnouncement(item.data);
    if (!item.isRead) markAnnouncementRead.mutate(item.id);
  }

  function handleMarkAllRead() {
    markAllRead.mutate();
    markAllAnnouncementsRead.mutate();
  }

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
                onClick={handleMarkAllRead}
                className={`text-xs font-medium bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent hover:opacity-80 transition-opacity`}
              >
                Mark all as read
              </button>
            )}
          </div>

          {feed.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-6">You&apos;re all caught up.</p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-96 overflow-y-auto">
              {feed.map((item) => {
                const title = item.kind === "notification" ? item.data.title : item.data.title;
                const message = item.kind === "notification" ? item.data.message : item.data.message;
                const meta = item.kind === "announcement" ? ANNOUNCEMENT_META : TYPE_META[item.data.type ?? ""] ?? DEFAULT_TYPE_META;
                const Icon = meta.icon;
                return (
                  <li
                    key={`${item.kind}-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-background cursor-pointer ${
                      item.pinned ? "bg-error-red/5 border border-error-red/20" : item.isRead ? "" : "bg-background/60"
                    }`}
                  >
                    <Icon size={16} className={`mt-0.5 shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      {title && (
                        <p
                          className={`text-sm leading-snug ${
                            item.isRead && !item.pinned ? "text-muted-text font-normal" : "text-body-text font-semibold"
                          }`}
                        >
                          {title}
                        </p>
                      )}
                      <p className={`text-sm leading-snug ${item.isRead && !item.pinned ? "text-muted-text" : "text-body-text"}`}>
                        {message}
                      </p>
                      <span className="text-xs text-hint-text">
                        {item.pinned ? "Action needed" : formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    {!item.isRead && !item.pinned && (
                      <span className={`mt-1.5 h-2 w-2 rounded-full bg-gradient-to-r ${accentGradient} shrink-0`} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <AnnouncementModal announcement={openAnnouncement} onClose={() => setOpenAnnouncement(null)} />
    </div>
  );
}
