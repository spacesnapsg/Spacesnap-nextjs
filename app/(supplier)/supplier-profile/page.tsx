"use client";

import { useState } from "react";
import { Mail, MapPin, Calendar, CheckCircle2, Download, FileText, Receipt as ReceiptIcon } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import {
  MOCK_SUPPLIER_PROFILE,
  MOCK_IS_COMPANY_ADMIN,
  MOCK_BUSINESS_DETAILS,
  MOCK_COMPANY_ADMIN_DETAILS,
  MOCK_LISTING_STATS,
  MOCK_RECEIVABLE_SUMMARY,
  MOCK_INVOICES,
  MOCK_RECEIPTS,
  type SupplierProfile,
  type BusinessDetails,
  type CompanyAdminDetails,
  type Invoice,
  type InvoiceStatus,
  type Receipt,
} from "@/lib/mockProfile";

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  Paid: "bg-success-green/15 text-success-green border-success-green/30",
  Pending: "bg-amber/15 text-amber border-amber/30",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="text-muted-text mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-text">{label}</p>
        <p className="text-sm text-body-text truncate">{value}</p>
      </div>
    </div>
  );
}

function CompanyAdminAccessCard() {
  const [requested, setRequested] = useState(false);

  if (MOCK_IS_COMPANY_ADMIN) {
    return (
      <Card className="mt-6">
        <p className="text-xs text-muted-text mb-3">Company Admin Access</p>
        <span className="inline-flex items-center gap-1.5 bg-supplier-purple-start/20 text-supplier-purple-end border border-supplier-purple-start/30 rounded-full px-3 py-1.5 text-xs font-semibold">
          <CheckCircle2 size={14} />
          Company Admin
        </span>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <p className="text-xs text-muted-text mb-3">Company Admin Access</p>
      <p className="text-sm text-muted-text mb-4">
        Request access to manage your company&apos;s suppliers and billing
      </p>
      <Button
        onClick={() => setRequested(true)}
        disabled={requested}
        className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end w-full disabled:opacity-50"
      >
        Request Promotion to Company Admin
      </Button>
      {requested && (
        <p className="text-xs text-supplier-purple-end mt-3 text-center">
          Request submitted &mdash; pending approval
        </p>
      )}
    </Card>
  );
}

function ProfileCard({
  profile,
  editing,
  onToggleEdit,
  onChange,
}: {
  profile: SupplierProfile;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: (field: "name" | "title" | "avatarUrl", value: string) => void;
}) {
  return (
    <Card>
      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-supplier-purple-start/20 text-supplier-purple-end border-4 border-supplier-purple-start/20 text-2xl font-semibold flex items-center justify-center overflow-hidden">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(profile.name)
          )}
        </div>

        <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end text-white rounded-full px-3 py-1 text-xs font-semibold mt-4">
          <CheckCircle2 size={12} />
          Verified Supplier
        </span>

        {editing ? (
          <div className="w-full flex flex-col gap-3 mt-4">
            <div>
              <label className="text-xs text-muted-text">Name</label>
              <Input
                value={profile.name}
                onChange={(e) => onChange("name", e.target.value)}
                className="w-full mt-1.5 focus:!border-supplier-purple-start"
              />
            </div>
            <div>
              <label className="text-xs text-muted-text">Title</label>
              <Input
                value={profile.title}
                onChange={(e) => onChange("title", e.target.value)}
                className="w-full mt-1.5 focus:!border-supplier-purple-start"
              />
            </div>
            <div>
              <label className="text-xs text-muted-text">Avatar URL</label>
              <Input
                value={profile.avatarUrl ?? ""}
                onChange={(e) => onChange("avatarUrl", e.target.value)}
                placeholder="https://..."
                className="w-full mt-1.5 focus:!border-supplier-purple-start"
              />
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-body-text mt-3">{profile.name}</h2>
            <p className="text-muted-text text-sm mt-0.5">{profile.title}</p>
          </>
        )}

        <div className="w-full flex flex-col gap-4 mt-6 text-left">
          <InfoRow icon={Mail} label="Email" value={profile.email} />
          <InfoRow icon={MapPin} label="Location" value={profile.location} />
          <InfoRow icon={Calendar} label="Member Since" value={profile.memberSince} />
        </div>

        <Button variant="ghost" className="w-full mt-6" onClick={onToggleEdit}>
          {editing ? "Cancel Editing" : "Edit Profile"}
        </Button>
      </div>
    </Card>
  );
}

function FieldDisplay({
  label,
  value,
  editing,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  if (editing) {
    return (
      <div>
        <label className="text-xs text-muted-text">{label}</label>
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded p-4 focus:outline-none focus:border-supplier-purple-start transition-colors resize-none"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-text">{label}</p>
      <p className={`text-sm text-body-text mt-1 ${multiline ? "" : "truncate"}`}>{value}</p>
    </div>
  );
}

function BusinessDetailsCard({
  editing,
  business,
  setBusiness,
}: {
  editing: boolean;
  business: BusinessDetails;
  setBusiness: (updater: (b: BusinessDetails) => BusinessDetails) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-body-text">Business Details</h3>
      </div>

      <div className="flex flex-col gap-4">
        <FieldDisplay
          label="Business Name"
          value={business.businessName}
          editing={editing}
          onChange={(v) => setBusiness((b) => ({ ...b, businessName: v }))}
        />
        <FieldDisplay
          label="Business Description"
          value={business.businessDescription}
          editing={editing}
          multiline
          onChange={(v) => setBusiness((b) => ({ ...b, businessDescription: v }))}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldDisplay
            label="Contact Email"
            value={business.contactEmail}
            editing={editing}
            onChange={(v) => setBusiness((b) => ({ ...b, contactEmail: v }))}
          />
          <FieldDisplay
            label="Years Operating"
            value={business.yearsOperating}
            editing={editing}
            onChange={(v) => setBusiness((b) => ({ ...b, yearsOperating: v }))}
          />
        </div>
        <FieldDisplay
          label="Business Location"
          value={business.businessLocation}
          editing={editing}
          onChange={(v) => setBusiness((b) => ({ ...b, businessLocation: v }))}
        />
      </div>
    </Card>
  );
}

function CompanyAdminDetailsCard({
  editing,
  companyAdmin,
  setCompanyAdmin,
}: {
  editing: boolean;
  companyAdmin: CompanyAdminDetails;
  setCompanyAdmin: (updater: (c: CompanyAdminDetails) => CompanyAdminDetails) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-body-text">Company Admin Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldDisplay
          label="Company Registration Number"
          value={companyAdmin.companyRegistrationNumber}
          editing={editing}
          onChange={(v) => setCompanyAdmin((c) => ({ ...c, companyRegistrationNumber: v }))}
        />
        <FieldDisplay
          label="Phone"
          value={companyAdmin.phone}
          editing={editing}
          onChange={(v) => setCompanyAdmin((c) => ({ ...c, phone: v }))}
        />
        <FieldDisplay
          label="Finance Point of Contact"
          value={companyAdmin.financePocName}
          editing={editing}
          onChange={(v) => setCompanyAdmin((c) => ({ ...c, financePocName: v }))}
        />
        <FieldDisplay
          label="Finance POC Email"
          value={companyAdmin.financePocEmail}
          editing={editing}
          onChange={(v) => setCompanyAdmin((c) => ({ ...c, financePocEmail: v }))}
        />
      </div>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-b-0">
      <p className="text-sm text-muted-text">{label}</p>
      <p className="text-sm font-semibold text-body-text">{value}</p>
    </div>
  );
}

function ListingStatsCard() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-body-text mb-2">Listing Stats</h3>
      <div>
        {MOCK_LISTING_STATS.map((stat) => (
          <StatRow key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </Card>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3 border-b border-border/40 last:border-b-0">
      <div className="min-w-0 md:w-40 shrink-0">
        <p className="text-sm font-semibold text-body-text">{invoice.id}</p>
      </div>
      <div className="min-w-0 md:flex-1">
        <p className="text-sm text-body-text truncate">{invoice.payer}</p>
        <p className="text-xs text-muted-text truncate">{invoice.listing}</p>
      </div>
      <div className="min-w-0 md:w-28 shrink-0">
        <p className="text-sm font-medium text-supplier-purple-end">{invoice.credits} cr</p>
        <p className="text-xs text-muted-text">Due {invoice.dueDate}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${INVOICE_STATUS_STYLES[invoice.status]}`}
        >
          {invoice.status}
        </span>
        <Button variant="ghost" className="h-9 px-4 text-sm">
          View Details
        </Button>
      </div>
    </div>
  );
}

function AccountsReceivableCard() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-body-text mb-5">Accounts Receivable</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end rounded p-5">
          <p className="text-xs text-white/80">Total Receivable</p>
          <p className="text-2xl font-bold text-white mt-1">
            ${MOCK_RECEIVABLE_SUMMARY.totalReceivable.toLocaleString()}
          </p>
        </div>
        <div className="bg-background border border-border/40 rounded p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-text">Overdue Amount</p>
            {MOCK_RECEIVABLE_SUMMARY.overdueAmount > 0 && (
              <span className="bg-error-red/15 text-error-red border border-error-red/30 rounded-full px-2 py-0.5 text-[10px] font-medium">
                Action Required
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-error-red mt-1">
            ${MOCK_RECEIVABLE_SUMMARY.overdueAmount.toLocaleString()}
          </p>
          <p className="text-xs text-muted-text mt-1">
            {MOCK_RECEIVABLE_SUMMARY.overdueCount} overdue invoice
            {MOCK_RECEIVABLE_SUMMARY.overdueCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div>
        {MOCK_INVOICES.map((invoice) => (
          <InvoiceRow key={invoice.id} invoice={invoice} />
        ))}
      </div>
    </Card>
  );
}

function ReceiptRow({ receipt }: { receipt: Receipt }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/40 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-supplier-purple-start/20 text-supplier-purple-end flex items-center justify-center shrink-0">
          <ReceiptIcon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-body-text truncate">{receipt.id}</p>
          <p className="text-xs text-muted-text truncate">
            {receipt.description} &middot; {receipt.date}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <p className="text-sm font-medium text-supplier-purple-end">{receipt.credits} cr</p>
        <button
          type="button"
          className="border border-border rounded p-2 text-muted-text hover:text-body-text transition-colors"
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function ReceiptsInvoicesCard() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-body-text mb-2 flex items-center gap-2">
        <FileText size={16} className="text-muted-text" />
        Receipts &amp; Invoices
      </h3>
      <div>
        {MOCK_RECEIPTS.map((receipt) => (
          <ReceiptRow key={`${receipt.id}-${receipt.date}`} receipt={receipt} />
        ))}
      </div>
    </Card>
  );
}

export default function SupplierProfilePage() {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<SupplierProfile>(MOCK_SUPPLIER_PROFILE);
  const [business, setBusiness] = useState<BusinessDetails>(MOCK_BUSINESS_DETAILS);
  const [companyAdmin, setCompanyAdmin] = useState<CompanyAdminDetails>(MOCK_COMPANY_ADMIN_DETAILS);

  function handleProfileChange(field: "name" | "title" | "avatarUrl", value: string) {
    setProfile((p) => ({ ...p, [field]: field === "avatarUrl" && !value ? null : value }));
  }

  function handleSave() {
    setEditing(false);
  }

  function handleToggleEdit() {
    setEditing((e) => !e);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
          Supplier Profile
        </h1>
        <p className="text-muted-text mt-1">Manage your supplier account and business information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ProfileCard
            profile={profile}
            editing={editing}
            onToggleEdit={handleToggleEdit}
            onChange={handleProfileChange}
          />
          <CompanyAdminAccessCard />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <BusinessDetailsCard editing={editing} business={business} setBusiness={setBusiness} />

          {MOCK_IS_COMPANY_ADMIN && (
            <CompanyAdminDetailsCard
              editing={editing}
              companyAdmin={companyAdmin}
              setCompanyAdmin={setCompanyAdmin}
            />
          )}

          {editing && (
            <Button
              onClick={handleSave}
              className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end w-fit self-end"
            >
              Save
            </Button>
          )}

          <ListingStatsCard />
          <AccountsReceivableCard />
          <ReceiptsInvoicesCard />
        </div>
      </div>
    </div>
  );
}
