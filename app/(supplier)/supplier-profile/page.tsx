"use client";

import { useState, type ChangeEvent } from "react";
import { useSession } from "next-auth/react";
import { Mail, Building2, Calendar, CheckCircle2, Camera, UserMinus, ShieldCheck, Check, X as XIcon } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useRequestPromotion } from "@/lib/hooks/usePromotions";
import { useSupplierCompany, useUpdateSupplierCompany, type BusinessDetailsFields } from "@/lib/hooks/useSupplierCompany";
import {
  useCompanyMembers,
  useRemoveCompanyMember,
  usePromoteCompanyMember,
  useCompanyJoinRequests,
  useResolveCompanyJoinRequest,
} from "@/lib/hooks/useCompanyMembers";
import { ApiRequestError } from "@/lib/api-client";
import SupplierEdmCard from "@/components/SupplierEdmCard";
import ListingBoostCatalogueCard from "@/components/ListingBoostCatalogueCard";

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

function CompanyAdminAccessCard({ promotionRequested }: { promotionRequested: boolean }) {
  const { data: session } = useSession();
  const requestPromotion = useRequestPromotion();
  const { data: members } = useCompanyMembers();

  if (session?.user?.isCompanyAdmin) {
    return (
      <Card>
        <p className="text-xs text-muted-text mb-3">Company Admin Access</p>
        <span className="inline-flex items-center gap-1.5 bg-supplier-purple-start/20 text-supplier-purple-end border border-supplier-purple-start/30 rounded-full px-3 py-1.5 text-xs font-semibold">
          <CheckCircle2 size={14} />
          Company Admin
        </span>
      </Card>
    );
  }

  // 2026-07-23 amendment: promotion only reaches the system-admin queue when
  // the company has no admin at all yet — once one exists, that admin
  // promotes members directly from the Team Members card below instead.
  const existingAdmin = members?.find((m) => m.isCompanyAdmin);
  const alreadyRequested = promotionRequested || requestPromotion.isSuccess;

  if (existingAdmin) {
    return (
      <Card>
        <p className="text-xs text-muted-text mb-3">Company Admin Access</p>
        <p className="text-sm text-muted-text">
          Ask your company admin, <span className="text-body-text font-medium">{existingAdmin.name}</span>, to
          promote you from the Team Members list.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-xs text-muted-text mb-3">Company Admin Access</p>
      <p className="text-sm text-muted-text mb-4">
        Request access to manage your company&apos;s suppliers and billing
      </p>
      <Button
        onClick={() => requestPromotion.mutate()}
        disabled={alreadyRequested || requestPromotion.isPending}
        className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end w-full disabled:opacity-50"
      >
        {alreadyRequested ? "Request Pending" : "Request Promotion to Company Admin"}
      </Button>
      {requestPromotion.isError && (
        <p className="text-xs text-error-red mt-3 text-center">
          {requestPromotion.error instanceof ApiRequestError
            ? requestPromotion.error.message
            : "Something went wrong."}
        </p>
      )}
      {alreadyRequested && !requestPromotion.isError && (
        <p className="text-xs text-muted-text mt-3 text-center">
          Awaiting system admin review.
        </p>
      )}
    </Card>
  );
}

// New, 2026-07-23 — company membership management. Member list to everyone
// at the company; admin-only Remove/Promote actions and the pending
// join-request queue (lib/company-membership.ts backs the actual logic —
// this card didn't exist before, Company had no "join"/"remove" concept at
// all until this session).
function TeamMembersCard() {
  const { data: session } = useSession();
  const { data: members } = useCompanyMembers();
  const removeMember = useRemoveCompanyMember();
  const promoteMember = usePromoteCompanyMember();
  const { data: requests } = useCompanyJoinRequests();
  const resolveRequest = useResolveCompanyJoinRequest();
  const [error, setError] = useState<string | null>(null);

  const isAdmin = Boolean(session?.user?.isCompanyAdmin);

  function handleError(err: unknown) {
    setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-body-text mb-4">Team Members</h3>

      {error && <p className="text-sm text-error-red mb-3">{error}</p>}

      <div className="flex flex-col gap-3">
        {!members || members.length === 0 ? (
          <p className="text-sm text-muted-text">No members yet.</p>
        ) : (
          members.map((member) => (
            <div key={member.id} className="flex items-center justify-between border border-border/40 rounded p-3">
              <div>
                <p className="text-sm font-medium text-body-text">
                  {member.name}
                  {member.isCompanyAdmin && (
                    <span className="ml-2 text-xs text-supplier-purple-end font-semibold">Admin</span>
                  )}
                </p>
                <p className="text-xs text-muted-text">{member.email}</p>
              </div>
              {isAdmin && !member.isCompanyAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Promote to admin"
                    disabled={promoteMember.isPending}
                    onClick={() => {
                      setError(null);
                      promoteMember.mutate(member.id, { onError: handleError });
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-supplier-purple-end transition-colors"
                  >
                    <ShieldCheck size={16} />
                  </button>
                  <button
                    type="button"
                    title="Remove member"
                    disabled={removeMember.isPending}
                    onClick={() => {
                      setError(null);
                      removeMember.mutate(member.id, { onError: handleError });
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-error-red transition-colors"
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isAdmin && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-body-text mb-3">
            Pending Join Requests
            {requests && requests.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-supplier-purple-end text-white text-[10px] font-semibold">
                {requests.length}
              </span>
            )}
          </h4>
          {!requests || requests.length === 0 ? (
            <p className="text-sm text-muted-text">No pending join requests.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between border border-border/40 rounded p-3">
                  <div>
                    <p className="text-sm font-medium text-body-text">{request.requestedBy.name}</p>
                    <p className="text-xs text-muted-text">{request.requestedBy.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={resolveRequest.isPending}
                      onClick={() => {
                        setError(null);
                        resolveRequest.mutate({ id: request.id, status: "approved" }, { onError: handleError });
                      }}
                      className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end h-8 px-3 text-xs gap-1"
                    >
                      <Check size={14} /> Approve
                    </Button>
                    <button
                      type="button"
                      disabled={resolveRequest.isPending}
                      onClick={() => {
                        setError(null);
                        resolveRequest.mutate({ id: request.id, status: "rejected" }, { onError: handleError });
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-error-red transition-colors"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const BUSINESS_DETAILS_FIELDS: { key: keyof BusinessDetailsFields; label: string }[] = [
  { key: "businessName", label: "Business Name" },
  { key: "businessDescription", label: "Description" },
  { key: "registrationNumber", label: "Registration Number" },
  { key: "financeContactEmail", label: "Finance Contact Email" },
  { key: "financeContactPerson", label: "Finance Contact Person" },
];

function BusinessDetailsCard() {
  const { data: session } = useSession();
  const { data: company, isLoading } = useSupplierCompany();
  const updateCompany = useUpdateSupplierCompany();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BusinessDetailsFields>({});

  function startEditing() {
    setDraft({
      businessName: company?.businessName ?? "",
      businessDescription: company?.businessDescription ?? "",
      registrationNumber: company?.registrationNumber ?? "",
      financeContactEmail: company?.financeContactEmail ?? "",
      financeContactPerson: company?.financeContactPerson ?? "",
    });
    setEditing(true);
  }

  function handleSave() {
    updateCompany.mutate(draft, { onSuccess: () => setEditing(false) });
  }

  const canEdit = Boolean(session?.user?.isCompanyAdmin);

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-body-text">Business Details</h3>
        {canEdit && !editing && !isLoading && (
          <Button variant="ghost" className="h-8 px-3 text-xs" onClick={startEditing}>
            Edit
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-text">Loading…</p>
      ) : editing ? (
        <div className="flex flex-col gap-4">
          {BUSINESS_DETAILS_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-text">{label}</label>
              <Input
                value={draft[key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full focus:!border-supplier-purple-start"
              />
            </div>
          ))}
          {updateCompany.isError && (
            <p className="text-xs text-error-red">
              {updateCompany.error instanceof ApiRequestError ? updateCompany.error.message : "Something went wrong."}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={updateCompany.isPending}
              className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end"
            >
              {updateCompany.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={updateCompany.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {BUSINESS_DETAILS_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-b-0">
              <p className="text-sm text-muted-text">{label}</p>
              <p className="text-sm text-body-text text-right truncate max-w-[60%]">{company?.[key] || "—"}</p>
            </div>
          ))}
          {!canEdit && (
            <p className="text-xs text-hint-text mt-1">Only your company admin can edit these details.</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function SupplierProfilePage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
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
        <div className="lg:col-span-1 flex flex-col gap-6">
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
          <TeamMembersCard />
          <CompanyAdminAccessCard promotionRequested={user?.promotionRequested ?? false} />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <ListingBoostCatalogueCard />
          <SupplierEdmCard />
          <BusinessDetailsCard />
        </div>
      </div>
    </div>
  );
}
