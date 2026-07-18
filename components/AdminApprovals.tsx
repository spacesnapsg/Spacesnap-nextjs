"use client";

import { useState } from "react";
import { CalendarCheck, Building2, Award } from "lucide-react";
import Card from "@/components/Card";
import {
  MOCK_PENDING_BOOKINGS,
  MOCK_PENDING_PROMOTIONS,
  type PendingBooking,
  type PendingPromotion,
} from "@/lib/mockAdminApprovals";
import { MOCK_PENDING_CERTIFICATES, type PendingCertificate } from "@/lib/mockAdminOverview";

type MainTab = "bookings" | "promotions" | "certificates";

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ApproveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-4 rounded text-sm font-medium border border-success-green text-success-green hover:bg-success-green/10 transition-colors"
    >
      Approve
    </button>
  );
}

function RejectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-4 rounded text-sm font-medium border border-error-red text-error-red hover:bg-error-red/10 transition-colors"
    >
      Reject
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-text text-center py-12">No pending {label}</p>;
}

function BookingsTab({ bookings, onApprove, onReject }: { bookings: PendingBooking[]; onApprove: (id: number) => void; onReject: (id: number) => void }) {
  if (bookings.length === 0) return <EmptyState label="bookings" />;
  return (
    <div>
      {bookings.map((b) => (
        <div key={b.id} className="py-4 border-b border-border/60 last:border-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-body-text font-bold">{b.listing}</p>
              <p className="text-xs text-muted-text mt-1">
                {b.user} · {b.company}
              </p>
              <p className="text-sm text-muted-text mt-2">
                {b.dateRange} · {b.bookingType} · {b.credits} cr
              </p>
              <p className="text-xs text-muted-text mt-2">Submitted {formatDate(b.submittedDate)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ApproveButton onClick={() => onApprove(b.id)} />
              <RejectButton onClick={() => onReject(b.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PromotionsTab({ promotions, onApprove, onReject }: { promotions: PendingPromotion[]; onApprove: (id: number) => void; onReject: (id: number) => void }) {
  if (promotions.length === 0) return <EmptyState label="promotion requests" />;
  return (
    <div>
      {promotions.map((p) => (
        <div key={p.id} className="py-4 border-b border-border/60 last:border-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-body-text font-bold">{p.name}</p>
              <p className="text-xs text-muted-text mt-1">
                {p.email} · {p.company}
              </p>
              <p className="text-sm text-muted-text mt-2">Requesting Company Admin access</p>
              <p className="text-xs text-muted-text mt-2">Submitted {formatDate(p.submittedDate)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ApproveButton onClick={() => onApprove(p.id)} />
              <RejectButton onClick={() => onReject(p.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CertificatesTab({ certificates, onApprove, onReject }: { certificates: PendingCertificate[]; onApprove: (id: number) => void; onReject: (id: number) => void }) {
  if (certificates.length === 0) return <EmptyState label="certificates" />;
  return (
    <div>
      {certificates.map((c) => (
        <div key={c.id} className="py-4 border-b border-border/60 last:border-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-body-text font-bold">{c.name}</p>
              <p className="text-xs text-muted-text mt-1">
                {c.category || "Uncategorized"} · {c.source === "supplier_created" ? "Submitted by supplier" : c.source}
              </p>
              <p className="text-sm text-muted-text mt-2">{c.context}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ApproveButton onClick={() => onApprove(c.id)} />
              <RejectButton onClick={() => onReject(c.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState<MainTab>("bookings");
  const [bookings, setBookings] = useState<PendingBooking[]>(MOCK_PENDING_BOOKINGS);
  const [promotions, setPromotions] = useState<PendingPromotion[]>(MOCK_PENDING_PROMOTIONS);
  const [certificates, setCertificates] = useState<PendingCertificate[]>(MOCK_PENDING_CERTIFICATES);

  // TODO: call PATCH /admin/bookings/{id}/approve|reject once the backend admin panel exists.
  function handleBookingDecision(id: number) {
    setBookings((prev) => prev.filter((b) => b.id !== id));
  }

  // TODO: call PATCH /admin/promotions/{id}/approve|reject once the backend admin panel exists.
  function handlePromotionDecision(id: number) {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
  }

  // TODO: call PATCH /admin/certificates/{id}/approve|reject once the backend admin panel exists.
  function handleCertificateDecision(id: number) {
    setCertificates((prev) => prev.filter((c) => c.id !== id));
  }

  const MAIN_TABS: { id: MainTab; label: string; count: number; icon: typeof CalendarCheck }[] = [
    { id: "bookings", label: "Bookings", count: bookings.length, icon: CalendarCheck },
    { id: "promotions", label: "Promotions", count: promotions.length, icon: Building2 },
    { id: "certificates", label: "Certificates", count: certificates.length, icon: Award },
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

        {activeTab === "bookings" && <BookingsTab bookings={bookings} onApprove={handleBookingDecision} onReject={handleBookingDecision} />}
        {activeTab === "promotions" && <PromotionsTab promotions={promotions} onApprove={handlePromotionDecision} onReject={handlePromotionDecision} />}
        {activeTab === "certificates" && <CertificatesTab certificates={certificates} onApprove={handleCertificateDecision} onReject={handleCertificateDecision} />}
      </Card>
    </div>
  );
}
