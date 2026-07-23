"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { BarChart3, Package, Building2, FileText, Landmark, User, UserCircle, LogOut } from "lucide-react";
import Navbar from "./Navbar";
import NavGroup, { NavItem } from "./NavGroup";
import LogoBox from "./LogoBox";
import NotificationsPanel from "./NotificationsPanel";

export default function SupplierNavbar() {
  // 2026-07-23: Member/Supplier/Both is now exclusive (proxy.ts), so a
  // Supplier-only account (isMember=false) can't actually reach
  // /marketplace — hide the shortcut rather than link somewhere that just
  // redirects back.
  const { data: session } = useSession();
  const isMember = Boolean(session?.user?.isMember);

  return (
    <Navbar
      logo={<LogoBox src="/logos/logo-purple.png" />}
      notifications={<NotificationsPanel accentGradient="from-supplier-purple-start to-supplier-purple-end" />}
      actions={
        <>
          {isMember && (
            <Link
              href="/marketplace"
              className="flex items-center gap-2 bg-gradient-to-r from-user-teal-start to-supplier-purple-start text-white text-sm font-semibold rounded-full pl-3 pr-4 h-10"
            >
              <UserCircle size={16} />
              User Portal
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
          {isMember && (
            <Link
              href="/marketplace"
              className="flex items-center gap-2 text-sm text-muted-text rounded-lg px-2 py-2 hover:bg-card transition-colors"
            >
              <UserCircle size={16} />
              User Portal
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
        <NavItem icon={<BarChart3 size={16} />} label="Analytics" href="/supplier" gradient="from-supplier-purple-start to-supplier-purple-end" />
        <NavItem icon={<Package size={16} />} label="Inventory" href="/supplier-inventory" gradient="from-supplier-purple-start to-supplier-purple-end" />
        <NavItem icon={<Building2 size={16} />} label="Tutorials" href="/supplier-tutorials" gradient="from-supplier-purple-start to-supplier-purple-end" />
        <NavItem icon={<FileText size={16} />} label="Requests" href="/supplier-requests" gradient="from-supplier-purple-start to-supplier-purple-end" />
        <NavItem icon={<Landmark size={16} />} label="Financials" href="/supplier-financials" gradient="from-supplier-purple-start to-supplier-purple-end" />
        <NavItem icon={<User size={16} />} label="Profile" href="/supplier-profile" gradient="from-supplier-purple-start to-supplier-purple-end" />
      </NavGroup>
    </Navbar>
  );
}
