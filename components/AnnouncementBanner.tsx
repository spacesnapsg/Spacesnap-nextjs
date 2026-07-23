"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useBanner, type BannerPortal } from "@/lib/hooks/useBanner";

function dismissalKey(portal: BannerPortal, id: string, updatedAt: string): string {
  return `banner-dismissed:${portal}:${id}:${updatedAt}`;
}

// Sprint 6.12 — layout-level mount (app/(user)/layout.tsx,
// app/(supplier)/layout.tsx), directly under the navbar, same placement
// tier as PendingBookingCreditModal. Dismissal is client-side localStorage
// keyed by id+updatedAt (not a DB table, unlike the EDM popup's
// lastEdmSeenAt) — re-uploading a new banner changes updatedAt, producing
// a new key, so the strip naturally reappears with no server round trip.
// Deliberately no useEffect: localStorage is read directly during render
// (guarded against SSR, where it doesn't exist) rather than mirrored into
// state — a bump counter is the only state, just to force a re-render after
// the dismiss button writes to localStorage (a plain mutation React can't
// otherwise see).
export default function AnnouncementBanner({ portal }: { portal: BannerPortal }) {
  const { data: banner } = useBanner(portal);
  const [, forceRerender] = useState(0);

  if (!banner) return null;

  const key = dismissalKey(portal, banner.id, banner.updatedAt);
  const isDismissed = typeof window !== "undefined" && localStorage.getItem(key) === "1";
  if (isDismissed) return null;

  return (
    <div className="relative w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={banner.imageUrl} alt="" className="w-full max-h-40 object-cover" />
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(key, "1");
          forceRerender((n) => n + 1);
        }}
        aria-label="Dismiss banner"
        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
