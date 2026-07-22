"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Building2, CalendarCheck, DollarSign, Award, Handshake } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { useAdminUsers } from "@/lib/hooks/useAdminUsers";
import {
  usePendingCertificates,
  useApproveCertificate,
  useRejectCertificate,
  type AdminCertificate,
} from "@/lib/hooks/useAdminCertificates";
import { usePendingPromotions } from "@/lib/hooks/usePromotions";
import { useAdminFinancials } from "@/lib/hooks/useAdminFinancials";
import { usePendingConciergeRedemptions, useResolveRewardRedemption } from "@/lib/hooks/useAdminRewardRedemptions";
import { ApiRequestError } from "@/lib/api-client";

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-admin-red-start to-admin-orange-end flex items-center justify-center">
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-muted-text text-sm">{label}</p>
        <p className="text-2xl font-semibold text-body-text mt-1">{value}</p>
      </div>
    </Card>
  );
}

function ApprovalRow({
  icon: Icon,
  label,
  count,
  onReview,
}: {
  icon: typeof Users;
  label: string;
  count: number | null;
  onReview?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-admin-red-start to-admin-orange-end flex items-center justify-center shrink-0">
          <Icon size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-body-text font-medium truncate">{label}</p>
          <p className="text-xs text-muted-text mt-0.5">
            {count === null ? "not wired yet" : `${count} pending`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold text-body-text w-8 text-right">{count ?? "—"}</span>
        {onReview && (
          <Button variant="ghost" onClick={onReview} className="h-9 px-4 text-sm">
            Review
          </Button>
        )}
      </div>
    </div>
  );
}

function CertificateReviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: certificates } = usePendingCertificates();
  const approveCertificate = useApproveCertificate();
  const rejectCertificate = useRejectCertificate();
  const [error, setError] = useState<string | null>(null);

  function handleApprove(id: string) {
    setError(null);
    approveCertificate.mutate(id, {
      onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong."),
    });
  }

  function handleReject(id: string) {
    setError(null);
    rejectCertificate.mutate(id, {
      onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong."),
    });
  }

  const list: AdminCertificate[] = certificates ?? [];

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Pending Certificates</h2>
      <p className="text-sm text-muted-text mb-6">
        Review supplier-submitted certificates before adding them to the pool.
      </p>

      {error && <p className="text-sm text-error-red mb-4">{error}</p>}

      {list.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-8">No pending certificates.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((cert) => (
            <div key={cert.id} className="border border-border rounded p-4">
              <p className="font-medium text-body-text">{cert.name}</p>
              <p className="text-xs text-muted-text mt-1">
                {cert.category || "Uncategorized"}
                {" · "}
                {cert.source === "supplier_created" ? `Submitted by ${cert.createdByCompanyName ?? "supplier"}` : cert.source}
              </p>
              {cert.submissionNotes && <p className="text-sm text-body-text mt-2">{cert.submissionNotes}</p>}
              <div className="flex items-center gap-2 mt-3">
                <Button
                  disabled={approveCertificate.isPending && approveCertificate.variables === cert.id}
                  onClick={() => handleApprove(cert.id)}
                  className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end h-9 px-4 text-sm"
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  disabled={rejectCertificate.isPending && rejectCertificate.variables === cert.id}
                  onClick={() => handleReject(cert.id)}
                  className="h-9 px-4 text-sm"
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// The pitch_ticket/consultancy "concierge" queue (2026-07-22 fulfillment
// session) — the admin arranges scheduling with the user's chosen partner
// out-of-band, then comes back here to mark it used (arranged) or cancelled
// (fell through). Same shape as CertificateReviewModal above.
function ConciergeReviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: redemptions } = usePendingConciergeRedemptions();
  const resolve = useResolveRewardRedemption();
  const [error, setError] = useState<string | null>(null);

  function handleResolve(id: string, status: "used" | "cancelled") {
    setError(null);
    resolve.mutate(
      { id, status },
      { onError: (e) => setError(e instanceof ApiRequestError ? e.message : "Something went wrong.") }
    );
  }

  const list = redemptions ?? [];

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Pending Concierge Requests</h2>
      <p className="text-sm text-muted-text mb-6">
        Arrange scheduling with each user&apos;s chosen partner, then mark the request as done.
      </p>

      {error && <p className="text-sm text-error-red mb-4">{error}</p>}

      {list.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-8">No pending concierge requests.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((redemption) => (
            <div key={redemption.id} className="border border-border rounded p-4">
              <p className="font-medium text-body-text">{redemption.itemName}</p>
              <p className="text-xs text-muted-text mt-1">
                {redemption.user.name} ({redemption.user.email})
                {redemption.selectedPartnerOption && ` · Partner: ${redemption.selectedPartnerOption}`}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  disabled={resolve.isPending && resolve.variables?.id === redemption.id}
                  onClick={() => handleResolve(redemption.id, "used")}
                  className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end h-9 px-4 text-sm"
                >
                  Mark Used
                </Button>
                <Button
                  variant="ghost"
                  disabled={resolve.isPending && resolve.variables?.id === redemption.id}
                  onClick={() => handleResolve(redemption.id, "cancelled")}
                  className="h-9 px-4 text-sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [conciergeModalOpen, setConciergeModalOpen] = useState(false);
  const { data: usersData } = useAdminUsers();
  const { data: pendingCertificates } = usePendingCertificates();
  const { data: pendingPromotions } = usePendingPromotions();
  const { data: financials } = useAdminFinancials();
  const { data: pendingConcierge } = usePendingConciergeRedemptions();

  const totalUsers = usersData?.meta.total;
  const certCount = pendingCertificates?.length ?? 0;
  const promotionCount = pendingPromotions?.length ?? 0;
  const conciergeCount = pendingConcierge?.length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Platform Overview
        </h1>
        <p className="text-muted-text mt-1">Platform-wide metrics and pending actions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Users" value={totalUsers === undefined ? "…" : String(totalUsers)} icon={Users} />
        <StatCard
          label="Total Companies"
          value={financials ? String(financials.summary.totalCompanies) : "…"}
          icon={Building2}
        />
        <StatCard
          label="Total Bookings"
          value={financials ? String(financials.summary.totalBookings) : "…"}
          icon={CalendarCheck}
        />
        <StatCard
          label="Platform Revenue"
          value={financials ? `${financials.summary.totalRevenue} credits` : "…"}
          icon={DollarSign}
        />
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold text-body-text">Pending Approvals</h2>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white text-xs font-semibold">
            {certCount}
          </span>
        </div>

        <div className="mt-4">
          <ApprovalRow
            icon={CalendarCheck}
            label="Pending Bookings"
            count={null}
            onReview={() => router.push("/admin-approvals")}
          />
          <ApprovalRow
            icon={Building2}
            label="Company Admin Promotion Requests"
            count={promotionCount}
            onReview={() => router.push("/admin-approvals")}
          />
          <ApprovalRow
            icon={Award}
            label="Pending Certificates"
            count={certCount}
            onReview={() => setCertModalOpen(true)}
          />
          <ApprovalRow
            icon={Handshake}
            label="Pending Concierge Requests"
            count={conciergeCount}
            onReview={() => setConciergeModalOpen(true)}
          />
        </div>
      </Card>

      <CertificateReviewModal open={certModalOpen} onClose={() => setCertModalOpen(false)} />
      <ConciergeReviewModal open={conciergeModalOpen} onClose={() => setConciergeModalOpen(false)} />
    </div>
  );
}
