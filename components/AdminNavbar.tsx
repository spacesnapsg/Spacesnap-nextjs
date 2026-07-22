"use client";

import { signOut } from "next-auth/react";
import { Home, Users, Gift, Banknote, UserCheck, Award, LogOut } from "lucide-react";
import Navbar from "./Navbar";
import NavGroup, { NavItem } from "./NavGroup";
import LogoBox from "./LogoBox";

export default function AdminNavbar() {
  return (
    <Navbar
      logo={<LogoBox src="/logos/logo-orange.png" />}
      actions={
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="border border-border rounded p-2 text-body-text"
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      }
      mobileActions={
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-sm text-muted-text rounded-lg px-2 py-2 hover:bg-card transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      }
    >
      <NavGroup>
        <NavItem icon={<Home size={16} />} label="Overview" href="/admin/dashboard" gradient="from-admin-red-start to-admin-orange-end" />
        <NavItem icon={<Users size={16} />} label="Users & Coys" href="/admin-users" gradient="from-admin-red-start to-admin-orange-end" />
        <NavItem icon={<Gift size={16} />} label="Rewards" href="/admin-rewards" gradient="from-admin-red-start to-admin-orange-end" />
        <NavItem icon={<Banknote size={16} />} label="Financials" href="/admin-financials" gradient="from-admin-red-start to-admin-orange-end" />
        <NavItem icon={<UserCheck size={16} />} label="Approvals" href="/admin-approvals" gradient="from-admin-red-start to-admin-orange-end" />
        <NavItem icon={<Award size={16} />} label="Certificates" href="/admin/certificates" gradient="from-admin-red-start to-admin-orange-end" />
      </NavGroup>
    </Navbar>
  );
}
