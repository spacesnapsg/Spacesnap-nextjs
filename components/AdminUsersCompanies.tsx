"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import Card from "@/components/Card";
import {
  useAdminUsers,
  useSuspendUser,
  useReinstateUser,
  type UserRole,
  type AccountStatus,
} from "@/lib/hooks/useAdminUsers";
import { useAdminCompanies } from "@/lib/hooks/useAdminCompanies";
import { ApiRequestError } from "@/lib/api-client";

type MainTab = "users" | "companies";
type RoleFilter = "all" | UserRole;

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "companies", label: "Companies" },
];

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "user", label: "User" },
  { id: "supplier", label: "Supplier" },
  { id: "company_admin", label: "Company Admin" },
  { id: "system_admin", label: "System Admin" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  user: "User",
  supplier: "Supplier",
  company_admin: "Company Admin",
  system_admin: "System Admin",
};

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  user: "bg-user-teal-start/15 text-user-teal-start border-user-teal-start/30",
  supplier: "bg-supplier-purple-start/15 text-supplier-purple-end border-supplier-purple-start/30",
  company_admin: "bg-amber/15 text-amber border-amber/30",
  system_admin: "bg-gradient-to-r from-admin-red-start/20 to-admin-orange-end/20 text-admin-orange-end border-admin-orange-end/30",
};

const STATUS_BADGE_STYLES: Record<AccountStatus, string> = {
  active: "bg-success-green/15 text-success-green border-success-green/30",
  suspended: "bg-white/10 text-muted-text border-white/20",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-block shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${ROLE_BADGE_STYLES[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={`inline-block shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_STYLES[status]}`}>
      {status === "active" ? "Active" : "Suspended"}
    </span>
  );
}

function ToggleStatusButton({
  status,
  disabled,
  onClick,
}: {
  status: AccountStatus;
  disabled: boolean;
  onClick: () => void;
}) {
  const isActive = status === "active";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 px-4 rounded text-sm font-medium border transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${
        isActive
          ? "border-error-red text-error-red hover:bg-error-red/10"
          : "border-success-green text-success-green hover:bg-success-green/10"
      }`}
    >
      {isActive ? "Suspend" : "Reinstate"}
    </button>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError } = useAdminUsers({
    role: roleFilter === "all" ? undefined : roleFilter,
    search: search.trim() || undefined,
  });
  const suspendUser = useSuspendUser();
  const reinstateUser = useReinstateUser();

  function handleToggleStatus(id: string, status: AccountStatus) {
    setActionError(null);
    const mutation = status === "active" ? suspendUser : reinstateUser;
    mutation.mutate(id, {
      onError: (error) => {
        setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      },
    });
  }

  const users = data?.users ?? [];

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-body-text">All Users</h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full sm:w-64 bg-background border border-border/40 rounded py-3 pr-4 pl-10 text-sm text-body-text placeholder:text-muted-text focus:outline-none focus:border-admin-red-start transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setRoleFilter(filter.id)}
                className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  roleFilter === filter.id
                    ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white"
                    : "text-muted-text hover:text-body-text"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {actionError && <p className="text-sm text-error-red mt-4">{actionError}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-text text-center py-12">Loading users…</p>
      ) : isError ? (
        <p className="text-sm text-error-red text-center py-12">Failed to load users.</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-12">No users found</p>
      ) : (
        <>
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-text whitespace-nowrap">Name</th>
                  <th className="py-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-text whitespace-nowrap">Email</th>
                  <th className="py-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-text whitespace-nowrap">Role</th>
                  <th className="py-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-text whitespace-nowrap">Company</th>
                  <th className="py-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-text whitespace-nowrap">Member Since</th>
                  <th className="py-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-text whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-text whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 px-3 text-sm text-body-text font-medium whitespace-nowrap">{user.name}</td>
                    <td className="py-3 px-3 text-sm text-muted-text whitespace-nowrap">{user.email}</td>
                    <td className="py-3 px-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="py-3 px-3 text-sm text-muted-text whitespace-nowrap">{user.companyName || "—"}</td>
                    <td className="py-3 px-3 text-sm text-muted-text whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="py-3 px-3">
                      <ToggleStatusButton
                        status={user.status}
                        disabled={
                          (suspendUser.isPending && suspendUser.variables === user.id) ||
                          (reinstateUser.isPending && reinstateUser.variables === user.id)
                        }
                        onClick={() => handleToggleStatus(user.id, user.status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.meta.total > users.length && (
            <p className="text-xs text-muted-text mt-4">
              Showing {users.length} of {data.meta.total} — pagination isn&apos;t wired up yet in this UI.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function CompaniesTab() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading, isError } = useAdminCompanies(search.trim() || undefined);

  const companies = data?.companies ?? [];

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-body-text">All Companies</h2>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company or business name..."
            className="w-full sm:w-64 bg-background border border-border/40 rounded py-3 pr-4 pl-10 text-sm text-body-text placeholder:text-muted-text focus:outline-none focus:border-admin-red-start transition-colors"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-text text-center py-12">Loading companies…</p>
      ) : isError ? (
        <p className="text-sm text-error-red text-center py-12">Failed to load companies.</p>
      ) : companies.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-12">No companies found</p>
      ) : (
        <div className="mt-6 flex flex-col">
          {companies.map((company) => {
            const expanded = expandedId === company.id;
            return (
              <div key={company.id} className="border-b border-border/60 last:border-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : company.id)}
                  className="w-full flex items-center justify-between gap-4 py-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {expanded ? (
                      <ChevronDown size={16} className="text-muted-text shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-muted-text shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-body-text truncate">{company.name}</p>
                      <p className="text-xs text-muted-text truncate">
                        {company.businessName ?? "—"}
                        {company.contactEmail ? ` · ${company.contactEmail}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <p className="text-xs text-muted-text">Members</p>
                      <p className="text-sm font-semibold text-body-text">{company.members.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-text">Listings</p>
                      <p className="text-sm font-semibold text-body-text">{company.listingCount}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-text">Since</p>
                      <p className="text-sm text-body-text">
                        {new Date(company.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="pb-4 pl-7">
                    {company.members.length === 0 ? (
                      <p className="text-sm text-muted-text py-2">No members.</p>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/40">
                            <th className="py-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-text">Name</th>
                            <th className="py-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-text">Email</th>
                            <th className="py-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-text">Role</th>
                            <th className="py-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-text">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {company.members.map((member) => (
                            <tr key={member.id} className="border-b border-border/20 last:border-0">
                              <td className="py-2 px-3 text-sm text-body-text whitespace-nowrap">{member.name}</td>
                              <td className="py-2 px-3 text-sm text-muted-text whitespace-nowrap">{member.email}</td>
                              <td className="py-2 px-3">
                                <RoleBadge role={member.role} />
                              </td>
                              <td className="py-2 px-3">
                                <StatusBadge status={member.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function AdminUsersCompanies() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<MainTab>(pathname?.includes("companies") ? "companies" : "users");

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Users & Companies
        </h1>
        <p className="text-muted-text mt-1">Manage platform users and company accounts</p>
      </div>

      <div className="inline-flex bg-card border border-border rounded-full p-1 gap-1 w-fit mb-6">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white" : "text-muted-text hover:text-body-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" ? <UsersTab /> : <CompaniesTab />}
    </div>
  );
}
