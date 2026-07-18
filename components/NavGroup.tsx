"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center gap-1 xl:gap-6 bg-background border border-border rounded-xl xl:rounded-2xl px-2 py-2 xl:px-6 xl:py-0 xl:h-11">
      {children}
    </div>
  );
}

export function NavItem({
  icon,
  label,
  href,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  gradient: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 text-sm whitespace-nowrap rounded-full px-3 py-2 xl:px-4 xl:py-2 transition-colors ${
        isActive
          ? `bg-gradient-to-r ${gradient} text-white`
          : "text-muted-text hover:bg-card xl:hover:bg-transparent"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
