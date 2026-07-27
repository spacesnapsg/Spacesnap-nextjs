"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import Card from "./Card";

export interface HamburgerMenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface HamburgerMenuProps {
  items: HamburgerMenuItem[];
  /** Shown as a small count badge on the trigger button, same treatment as NotificationsPanel's bell badge. */
  badgeCount?: number;
}

// Generic navbar overflow menu — same click-outside-to-close dropdown pattern
// as NotificationsPanel, for links that don't warrant their own nav slot.
export default function HamburgerMenu({ items, badgeCount = 0 }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        aria-label="More"
        aria-expanded={open}
        className="relative border border-border rounded p-2 text-body-text"
      >
        <Menu size={18} />
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-error-red text-[10px] font-semibold text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <Card className="absolute right-0 top-full mt-3 w-52 !p-2 z-50">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-body-text hover:bg-background transition-colors"
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
