"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export default function Navbar({
  children,
  actions,
  mobileActions,
  notifications,
  logo,
  className = "",
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  mobileActions?: React.ReactNode;
  notifications?: React.ReactNode;
  logo?: React.ReactNode;
  className?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className={`w-full bg-card border-b border-border relative ${className}`}>
      <div className="h-16 md:h-20 flex items-center justify-between gap-2 px-4 md:px-6">
        <div className="shrink-0">
          {logo ?? (
            <Image
              src="/logos/spacesnap-logo.png"
              alt="SpaceSnap"
              width={160}
              height={40}
              className="h-8 md:h-10 w-auto"
            />
          )}
        </div>

        <nav className="hidden xl:flex items-center gap-2 justify-self-center">{children}</nav>

        <div className="flex items-center gap-2 md:gap-4 justify-self-end">
          {notifications}
          <div className="hidden xl:flex items-center gap-2 md:gap-4">{actions}</div>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="xl:hidden border border-border rounded p-2 text-body-text"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="xl:hidden absolute left-0 right-0 top-full bg-card border-b border-border px-4 py-3 z-40 flex flex-col gap-3">
          {children}
          {mobileActions && (
            <div className="flex flex-col gap-1 pt-3 border-t border-border">{mobileActions}</div>
          )}
        </nav>
      )}
    </header>
  );
}
