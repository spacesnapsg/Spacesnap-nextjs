"use client";

import { useState, type ChangeEvent } from "react";
import { useSession } from "next-auth/react";
import { Mail, Building2, Calendar, CheckCircle2, Camera } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useSupplierListings } from "@/lib/hooks/useSupplierListings";
import { useSupplierBookings } from "@/lib/hooks/useSupplierBookings";

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
  const { data: session } = useSession();
  const [requested, setRequested] = useState(false);

  if (session?.user?.isCompanyAdmin) {
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
        <p className="text-xs text-muted-text mt-3 text-center">
          Not wired yet — there&apos;s no endpoint to submit this request (the
          <code> promotionRequested</code> column exists but nothing writes to it). Tracked as a
          backend gap.
        </p>
      )}
    </Card>
  );
}

export default function SupplierProfilePage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: listings } = useSupplierListings();
  const { data: bookings } = useSupplierBookings();
  const [editing, setEditing] = useState(false);
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [avatarEdit, setAvatarEdit] = useState<string | null>(null);

  const name = nameEdit ?? user?.name ?? "";
  const title = titleEdit ?? user?.title ?? "";
  const avatarUrl = avatarEdit ?? user?.avatarUrl ?? null;

  function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarEdit(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleToggleEdit() {
    if (!editing) {
      setNameEdit(null);
      setTitleEdit(null);
      setAvatarEdit(null);
    }
    setEditing((e) => !e);
  }

  const completedBookingsCount = (bookings ?? []).filter((b) => b.status === "completed").length;

  if (userLoading) {
    return <p className="text-sm text-muted-text text-center py-16">Loading profile…</p>;
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
          <Card>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-supplier-purple-start/20 text-supplier-purple-end border-4 border-supplier-purple-start/20 text-2xl font-semibold flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(name || "?")
                  )}
                </div>
                {editing && (
                  <label
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-supplier-purple-start border-2 border-card flex items-center justify-center text-white cursor-pointer hover:bg-supplier-purple-end transition-colors"
                    aria-label="Upload avatar"
                  >
                    <Camera size={14} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                  </label>
                )}
              </div>

              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end text-white rounded-full px-3 py-1 text-xs font-semibold mt-4">
                <CheckCircle2 size={12} />
                Verified Supplier
              </span>

              {editing ? (
                <div className="w-full flex flex-col gap-4 mt-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-text">Full Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setNameEdit(e.target.value)}
                      className="w-full focus:!border-supplier-purple-start"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-text">Job Title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitleEdit(e.target.value)}
                      className="w-full focus:!border-supplier-purple-start"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-body-text mt-3">{name}</h2>
                  <p className="text-muted-text text-sm mt-0.5">{title}</p>
                </>
              )}

              <div className="w-full flex flex-col gap-4 mt-6 text-left">
                <InfoRow icon={Mail} label="Email" value={user?.email ?? ""} />
                <InfoRow icon={Building2} label="Company" value={user?.companyName ?? "—"} />
                <InfoRow
                  icon={Calendar}
                  label="Member Since"
                  value={
                    user ? new Date(user.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""
                  }
                />
              </div>

              <Button variant="ghost" className="w-full mt-6" onClick={handleToggleEdit}>
                {editing ? "Cancel Editing" : "Edit Profile"}
              </Button>
            </div>
          </Card>
          <CompanyAdminAccessCard />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <h3 className="text-base font-semibold text-body-text mb-2">Business Details</h3>
            <p className="text-sm text-muted-text">
              Not wired yet — the <code>Company</code> model has some overlapping fields (business
              name/location/contact email) but no route exposes them for editing, and fields like
              registration number and finance contact person have no backing columns at all. Tracked
              as a backend gap.
            </p>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-body-text mb-2">Listing Stats</h3>
            <div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/40">
                <p className="text-sm text-muted-text">Total Listings</p>
                <p className="text-sm font-semibold text-body-text">{(listings ?? []).length}</p>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/40">
                <p className="text-sm text-muted-text">Total Completed Bookings</p>
                <p className="text-sm font-semibold text-body-text">{completedBookingsCount}</p>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-b-0">
                <p className="text-sm text-muted-text">Average Rating</p>
                <p className="text-sm text-muted-text italic">No rating system built yet</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-body-text mb-2">Accounts Receivable, Receipts &amp; Invoices</h3>
            <p className="text-sm text-muted-text">
              Not wired yet — there&apos;s no Invoice, Receipt, or payout concept in the schema at
              all (Sprint 6&apos;s Stripe integration is unbuilt). Tracked as a backend gap.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
