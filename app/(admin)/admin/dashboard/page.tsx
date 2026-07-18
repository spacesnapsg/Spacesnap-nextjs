"use client";

import { useState } from "react";
import { Users, Building2, CalendarCheck, DollarSign, Award } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import {
  MOCK_ADMIN_STATS,
  MOCK_PENDING_BOOKINGS,
  MOCK_PENDING_VERIFICATIONS,
  MOCK_PROMOTION_REQUESTS,
  MOCK_PENDING_CERTIFICATES,
  type PendingCertificate,
} from "@/lib/mockAdminOverview";

const STAT_ICONS = [Users, Building2, CalendarCheck, DollarSign];

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
  count: number;
  onReview: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-admin-red-start to-admin-orange-end flex items-center justify-center shrink-0">
          <Icon size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-body-text font-medium truncate">{label}</p>
          <p className="text-xs text-muted-text mt-0.5">{count} pending</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold text-body-text w-8 text-right">{count}</span>
        <Button variant="ghost" onClick={onReview} className="h-9 px-4 text-sm">
          Review
        </Button>
      </div>
    </div>
  );
}

function CertificateReviewModal({
  open,
  onClose,
  certificates,
  onApprove,
  onReject,
}: {
  open: boolean;
  onClose: () => void;
  certificates: PendingCertificate[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Pending Certificates</h2>
      <p className="text-sm text-muted-text mb-6">
        Review supplier-submitted certificates before adding them to the pool.
      </p>

      {certificates.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-8">No pending certificates.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {certificates.map((cert) => (
            <div key={cert.id} className="border border-border rounded p-4">
              <p className="font-medium text-body-text">{cert.name}</p>
              <p className="text-xs text-muted-text mt-1">
                {cert.category || "Uncategorized"}
                {" · "}
                {cert.source === "supplier_created" ? "Submitted by supplier" : cert.source}
              </p>
              <p className="text-sm text-body-text mt-2">{cert.context}</p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={() => onApprove(cert.id)}
                  className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end h-9 px-4 text-sm"
                >
                  Approve
                </Button>
                <Button variant="ghost" onClick={() => onReject(cert.id)} className="h-9 px-4 text-sm">
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

export default function AdminOverviewPage() {
  const [certificates, setCertificates] = useState<PendingCertificate[]>(MOCK_PENDING_CERTIFICATES);
  const [certModalOpen, setCertModalOpen] = useState(false);

  function handleApprove(id: number) {
    setCertificates((prev) => prev.filter((c) => c.id !== id));
  }

  function handleReject(id: number) {
    setCertificates((prev) => prev.filter((c) => c.id !== id));
  }

  const totalPending =
    MOCK_PENDING_BOOKINGS + MOCK_PENDING_VERIFICATIONS + MOCK_PROMOTION_REQUESTS + certificates.length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Platform Overview
        </h1>
        <p className="text-muted-text mt-1">Platform-wide metrics and pending actions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {MOCK_ADMIN_STATS.map((stat, i) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} icon={STAT_ICONS[i]} />
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold text-body-text">Pending Approvals</h2>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white text-xs font-semibold">
            {totalPending}
          </span>
        </div>

        <div className="mt-4">
          <ApprovalRow icon={CalendarCheck} label="Pending Bookings" count={MOCK_PENDING_BOOKINGS} onReview={() => {}} />
          <ApprovalRow
            icon={Users}
            label="Pending Verifications"
            count={MOCK_PENDING_VERIFICATIONS}
            onReview={() => {}}
          />
          <ApprovalRow
            icon={Building2}
            label="Company Admin Promotion Requests"
            count={MOCK_PROMOTION_REQUESTS}
            onReview={() => {}}
          />
          <ApprovalRow
            icon={Award}
            label="Pending Certificates"
            count={certificates.length}
            onReview={() => setCertModalOpen(true)}
          />
        </div>
      </Card>

      <CertificateReviewModal
        open={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        certificates={certificates}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
