"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Navbar from "./Navbar";

const RESOURCES_LINKS = [
  { label: "Product Roadmap", href: "/resources/product-roadmap" },
  { label: "SpaceSnap Insights", href: "/resources/insights" },
  { label: "Latest Releases", href: "/resources/latest-releases" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`text-sm whitespace-nowrap transition-colors ${
        isActive ? "text-white" : "text-muted-text hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function ResourcesDropdown() {
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
        aria-expanded={open}
        className="flex items-center gap-1 text-sm text-muted-text hover:text-white transition-colors"
      >
        Resources
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-3 w-56 rounded-card border border-border bg-card p-2 z-50">
          {RESOURCES_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm text-muted-text hover:bg-background hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketingNavbar() {
  return (
    <Navbar
      logo={
        <Image
          src="/logos/spacesnap-wordmark-transparent.png"
          alt="SpaceSnap"
          width={1403}
          height={274}
          className="h-8 md:h-10 w-auto"
        />
      }
      actions={
        <Link
          href="/login"
          className="inline-flex items-center justify-center h-10 px-5 rounded-full text-sm font-semibold bg-user-teal-end hover:bg-user-teal-start text-white transition-colors"
        >
          Sign In
        </Link>
      }
      mobileActions={
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm text-muted-text rounded-lg px-2 py-2 hover:bg-card transition-colors"
        >
          Sign In
        </Link>
      }
    >
      <div className="flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-8">
        <NavLink href="/" label="Home" />
        <NavLink href="/about" label="About Us" />
        <NavLink href="/partners" label="Partners" />
        <ResourcesDropdown />
      </div>
    </Navbar>
  );
}
