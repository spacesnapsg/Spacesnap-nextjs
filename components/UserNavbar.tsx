"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Globe, IdCard, Wallet, LayoutDashboard, LogOut, Building2 } from "lucide-react";
import Navbar from "./Navbar";
import NavGroup, { NavItem } from "./NavGroup";
import LogoBox from "./LogoBox";
import NotificationsPanel from "./NotificationsPanel";

export default function UserNavbar() {
  // 2026-07-23: Member/Supplier/Both is now exclusive (proxy.ts), so a
  // Member-only account (isSupplier=false) can't actually reach /supplier —
  // hide the shortcut rather than link somewhere that just redirects back.
  const { data: session } = useSession();
  const isSupplier = Boolean(session?.user?.isSupplier);

  return (
    <Navbar
      logo={<LogoBox src="/logos/logo-teal.png" />}
      notifications={<NotificationsPanel accentGradient="from-user-teal-start to-user-teal-end" />}
      actions={
        <>
          {isSupplier && (
            <Link
              href="/supplier"
              className="flex items-center gap-2 bg-gradient-to-r from-user-teal-start to-supplier-purple-start text-white text-sm font-semibold rounded-full pl-3 pr-4 h-10"
            >
              <Building2 size={16} />
              Supplier Portal
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="border border-border rounded p-2 text-body-text"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </>
      }
      mobileActions={
        <>
          {isSupplier && (
            <Link
              href="/supplier"
              className="flex items-center gap-2 text-sm text-muted-text rounded-lg px-2 py-2 hover:bg-card transition-colors"
            >
              <Building2 size={16} />
              Supplier Portal
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 text-sm text-muted-text rounded-lg px-2 py-2 hover:bg-card transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </>
      }
    >
      <NavGroup>
        <NavItem icon={<Globe size={16} />} label="Discover" href="/marketplace" gradient="from-user-teal-start to-user-teal-end" />
        <NavItem icon={<IdCard size={16} />} label="Digital Passport" href="/passport" gradient="from-user-teal-start to-user-teal-end" />
        <NavItem icon={<Wallet size={16} />} label="Financials" href="/wallet" gradient="from-user-teal-start to-user-teal-end" />
        <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" href="/user" gradient="from-user-teal-start to-user-teal-end" />
      </NavGroup>
    </Navbar>
  );
}
