"use client";

import { useState } from "react";
import { CalendarCheck, Building2, Award } from "lucide-react";
import Card from "@/components/Card";
import {
  usePendingCertificates,
  useApproveCertificate,
  useRejectCertificate,
} from "@/lib/hooks/useAdminCertificates";
import { ApiRequestError } from "@/lib/api-client";

type MainTab = "bookings" | "promotions" | "certificates";

function ApproveButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 px-4 rounded text-sm font-medium border border-success-green text-success-green hover:bg-success-green/10 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      Approve
    </button>
  );
}

function RejectButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 px-4 rounded text-sm font-medium border border-error-red text-error-red hover:bg-error-red/10 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      Reject
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-text text-center py-12">No pending {label}</p>;
}

function GapNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-text py-8">{children}</p>;
}

function CertificatesTab() {
  const { data: certificates, isLoading, isError } = usePendingCertificates();
  const approveCertificate = useApproveCertificate();
  const rejectCertificate = useRejectCertificate();
  const [actionError, setActionError] = useState<string | null>(null);

  function handleApprove(id: string) {
    setActionError(null);
    approveCertificate.mutate(id, {
      onError: (error) => setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong."),
    });
  }

  function handleReject(id: string) {
    setActionError(null);
    rejectCertificate.mutate(id, {
      onError: (error) => setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong."),
    });
  }

  if (isLoading) return <p className="text-sm text-muted-text text-center py-12">Loading…</p>;
  if (isError) return <p className="text-sm text-error-red text-center py-12">Failed to load.</p>;
  if (!certificates || certificates.length === 0) return <EmptyState label="certificates" />;

  return (
    <div>
      {actionError && <p className="text-sm text-error-red mb-4">{actionError}</p>}
      {certificates.map((c) => (
        <div key={c.id} className="py-4 border-b border-border/60 last:border-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-body-text font-bold">{c.name}</p>
              <p className="text-xs text-muted-text mt-1">
                {c.category || "Uncategorized"} ·{" "}
                {c.source === "supplier_created" ? `Submitted by ${c.createdByCompanyName ?? "supplier"}` : c.source}
              </p>
              {c.submissionNotes && <p className="text-sm text-muted-text mt-2">{c.submissionNotes}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ApproveButton
                disabled={approveCertificate.isPending && approveCertificate.variables === c.id}
                onClick={() => handleApprove(c.id)}
              />
              <RejectButton
                disabled={rejectCertificate.isPending && rejectCertificate.variables === c.id}
                onClick={() => handleReject(c.id)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState<MainTab>("bookings");
  const { data: pendingCertificates } = usePendingCertificates();

  const MAIN_TABS: { id: MainTab; label: string; count: number; icon: typeof CalendarCheck }[] = [
    { id: "bookings", label: "Bookings", count: 0, icon: CalendarCheck },
    { id: "promotions", label: "Promotions", count: 0, icon: Building2 },
    { id: "certificates", label: "Certificates", count: pendingCertificates?.length ?? 0, icon: Award },
  ];

  const activeTabMeta = MAIN_TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Approvals
        </h1>
        <p className="text-muted-text mt-1">Review and action pending requests across the platform</p>
      </div>

      <div className="flex flex-wrap bg-card border border-border rounded-full p-1 gap-1 w-fit mb-6">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === tab.id ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white" : "text-muted-text hover:text-body-text"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-white/10 text-muted-text"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <activeTabMeta.icon size={18} className="text-admin-orange-end" />
          <h2 className="text-lg font-semibold text-body-text">{activeTabMeta.label}</h2>
        </div>

        {activeTab === "bookings" && (
          <GapNote>
            Not wired yet — there&apos;s no admin-level booking approval concept in this backend.
            Bookings are confirmed/declined by the supplier who owns the listing (Requests page), not
            by a system admin. Tracked as a backend gap in case an admin-override flow is wanted.
          </GapNote>
        )}
        {activeTab === "promotions" && (
          <GapNote>
            Not wired yet — there&apos;s no <code>GET /api/admin/promotions/pending</code> or
            approve/reject route. The <code>promotionRequested</code> column exists on{" "}
            <code>users</code> but nothing reads or writes it yet. Tracked as a backend gap.
          </GapNote>
        )}
        {activeTab === "certificates" && <CertificatesTab />}
      </Card>
    </div>
  );
}
