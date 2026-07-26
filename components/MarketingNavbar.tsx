"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Navbar from "./Navbar";

const PLATFORM_LINKS = [
  { label: "Marketplace", href: "/platform/marketplace" },
  { label: "Digital Passport", href: "/platform/digital-passport" },
  { label: "List & Fill", href: "/platform/list-and-fill" },
];

const SOLUTIONS_LINKS = [
  { label: "For Startups", href: "/solutions/startups" },
  { label: "For Space Providers", href: "/solutions/space-providers" },
  { label: "For Suppliers", href: "/solutions/suppliers" },
];

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

function NavDropdown({
  label,
  links,
}: {
  label: string;
  links: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = links.some(({ href }) => pathname === href);

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
    <div
      className="relative"
      ref={containerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isActive ? "text-white" : "text-muted-text hover:text-white"
        }`}
      >
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        // pt-3 (not mt-3 on the inner box) keeps the gap above the panel
        // inside this wrapper's own hit-area, so moving the mouse straight
        // down from the button into the panel doesn't cross a dead zone
        // and trigger onMouseLeave early.
        <div className="absolute left-0 top-full pt-3 z-50">
          <div className="w-56 rounded-card border border-border bg-card p-2">
            {links.map(({ label: linkLabel, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="group relative block rounded px-3 py-2 text-sm text-muted-text hover:text-white transition-colors"
              >
                <span className="relative">
                  {linkLabel}
                  <span
                    aria-hidden
                    className="absolute left-0 -bottom-0.5 h-px w-full origin-left scale-x-0 bg-user-teal-end transition-transform duration-300 ease-out group-hover:scale-x-100"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketingNavbar({
  accent = "teal",
}: {
  /** Supplier-facing pages (e.g. List & Fill) use the purple accent instead of the default member teal. */
  accent?: "teal" | "purple";
}) {
  const signInClass =
    accent === "purple"
      ? "bg-supplier-purple-start hover:bg-supplier-purple-end"
      : "bg-user-teal-end hover:bg-user-teal-start";

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
          className={`inline-flex items-center justify-center h-10 px-5 rounded-full text-sm font-semibold text-white transition-colors ${signInClass}`}
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
        <NavDropdown label="Platform" links={PLATFORM_LINKS} />
        <NavDropdown label="Solutions" links={SOLUTIONS_LINKS} />
        <NavLink href="/partners" label="Partners" />
        <NavDropdown label="Resources" links={RESOURCES_LINKS} />
      </div>
    </Navbar>
  );
}
