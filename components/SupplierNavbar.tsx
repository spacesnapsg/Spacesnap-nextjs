import Link from "next/link";
import { BarChart3, Package, Building2, FileText, User, UserCircle, LogOut } from "lucide-react";
import Navbar from "./Navbar";
import NavGroup, { NavItem } from "./NavGroup";
import LogoBox from "./LogoBox";

export default function SupplierNavbar() {
  return (
    <Navbar
      logo={<LogoBox src="/logos/logo-purple.png" />}
      actions={
        <>
          <Link
            href="/marketplace"
            className="flex items-center gap-2 bg-gradient-to-r from-user-teal-start to-supplier-purple-start text-white text-sm font-semibold rounded-full pl-3 pr-4 h-10"
          >
            <UserCircle size={16} />
            User Portal
          </Link>
          <button className="border border-border rounded p-2 text-body-text" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </>
      }
      mobileActions={
        <>
          <Link
            href="/marketplace"
            className="flex items-center gap-2 text-sm text-muted-text rounded-lg px-2 py-2 hover:bg-card transition-colors"
          >
            <UserCircle size={16} />
            User Portal
          </Link>
          <button className="flex items-center gap-2 text-sm text-muted-text rounded-lg px-2 py-2 hover:bg-card transition-colors">
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
        <NavItem icon={<User size={16} />} label="Profile" href="/supplier-profile" gradient="from-supplier-purple-start to-supplier-purple-end" />
      </NavGroup>
    </Navbar>
  );
}
