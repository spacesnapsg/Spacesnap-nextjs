"use client";

import { Building2, User } from "lucide-react";
import { useBuyerOrganization } from "@/lib/hooks/useBuyerOrganization";

export type FundingSource = "personal" | "organization";

interface FundingSourceSelectorProps {
  value: FundingSource;
  onChange: (value: FundingSource) => void;
  // Which of the caller's own delegated rights this checkout cares about —
  // "book" for BookingModal, "purchase" for RequestPurchaseModal's Buy Now
  // path. A member without the relevant permission can still pick
  // "organization" here; the parent modal is responsible for submitting a
  // BuyerOrgSpendRequest instead of the direct booking/purchase in that case
  // (see useBuyerOrganization's own `canBook`/`canPurchase`, already folded
  // for admins).
  permission: "book" | "purchase";
}

// 2026-07-28 "Buyer Org pool — delegated spend." Renders nothing (and the
// parent should just treat funding as "personal") when the caller doesn't
// belong to an organization at all — most users never see this.
export default function FundingSourceSelector({ value, onChange, permission }: FundingSourceSelectorProps) {
  const { data } = useBuyerOrganization();
  const organization = data?.organization;
  if (!organization) return null;

  const hasPermission = permission === "book" ? organization.canBook : organization.canPurchase;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-text">Pay with</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("personal")}
          className={`flex-1 flex items-center gap-2 rounded border px-3 py-2.5 text-left transition-colors ${
            value === "personal"
              ? "bg-user-teal-start/10 border-user-teal-start"
              : "bg-background border-border hover:border-user-teal-start/50"
          }`}
        >
          <User size={16} className="text-muted-text shrink-0" />
          <span className="text-sm text-body-text">Personal</span>
        </button>
        <button
          type="button"
          onClick={() => onChange("organization")}
          className={`flex-1 flex items-center gap-2 rounded border px-3 py-2.5 text-left transition-colors ${
            value === "organization"
              ? "bg-user-teal-start/10 border-user-teal-start"
              : "bg-background border-border hover:border-user-teal-start/50"
          }`}
        >
          <Building2 size={16} className="text-muted-text shrink-0" />
          <span className="text-sm text-body-text truncate">{organization.name}</span>
        </button>
      </div>
      {value === "organization" && (
        <p className="text-xs text-muted-text">
          {hasPermission
            ? `Pool balance: ${organization.poolBalance} credits.`
            : "You don't have permission to spend the pool directly — this will be sent to your organization admin for approval."}
        </p>
      )}
    </div>
  );
}
