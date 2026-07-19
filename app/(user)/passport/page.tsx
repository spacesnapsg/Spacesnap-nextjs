"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Award, Building2, Calendar, Camera, Check, Lock, Mail, Trophy, User } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import CertificateDetailModal from "@/components/CertificateDetailModal";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useCertificateCatalog, type Certificate } from "@/lib/hooks/useCertificates";
import { useCredentials } from "@/lib/hooks/useCredentials";

function CertBadge({
  certificate,
  earned,
  onSelect,
}: {
  certificate: Certificate;
  earned: boolean;
  onSelect: (certificate: Certificate) => void;
}) {
  if (!earned) {
    return (
      <div className="bg-background border border-border/60 rounded p-3 flex flex-col items-center justify-center gap-1.5 text-center opacity-60">
        <span className="h-7 w-7 rounded-full bg-card flex items-center justify-center">
          <Lock size={10} className="text-muted-text" />
        </span>
        <p className="text-xs font-medium text-muted-text leading-snug">{certificate.name}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(certificate)}
      className="relative text-left bg-background border border-border/60 rounded p-3 flex flex-col items-center justify-center gap-1.5 text-center hover:border-user-teal-start/50 transition-colors"
    >
      <span className="absolute top-1.5 right-1.5 h-3 w-3 rounded-full bg-user-teal-start flex items-center justify-center">
        <Check size={7} className="text-white" />
      </span>
      <span className="text-lg">{certificate.icon}</span>
      <p className="text-xs font-semibold text-body-text leading-snug">{certificate.name}</p>
    </button>
  );
}

export default function DigitalPassportPage() {
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: catalog, isLoading: catalogLoading } = useCertificateCatalog();
  const { data: credentials } = useCredentials();

  const [profileEdits, setProfileEdits] = useState<{ name: string; title: string; companyName: string; avatarUrl: string | null } | null>(
    null
  );

  const profile = profileEdits ?? {
    name: user?.name ?? "",
    title: user?.title ?? "",
    companyName: user?.companyName ?? "",
    avatarUrl: user?.avatarUrl ?? null,
  };

  function handleProfileChange(field: "name" | "title" | "companyName" | "avatarUrl", value: string) {
    setProfileEdits({ ...profile, [field]: value });
  }

  function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleProfileChange("avatarUrl", reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleToggleEdit() {
    if (!editing) setProfileEdits(null);
    setEditing((e) => !e);
  }

  const earnedCertIds = useMemo(() => new Set((credentials ?? []).map((c) => c.certificateId)), [credentials]);
  const selectedCertificate = catalog?.find((cert) => cert.id === selectedCertId) ?? null;
  const selectedCredential = credentials?.find((c) => c.certificateId === selectedCertId) ?? null;

  if (userLoading || catalogLoading) {
    return <p className="text-sm text-muted-text text-center py-16">Loading passport…</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-user-teal-start to-user-teal-end bg-clip-text text-transparent">
          Digital Passport
        </h1>
        <p className="text-muted-text mt-1">
          Your certifications, training, and credentials in one place
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-8">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col items-center text-center gap-1">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-muted-text" />
                )}
              </div>
              {editing && (
                <label
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-user-teal-start border-2 border-card flex items-center justify-center text-white cursor-pointer hover:bg-user-teal-end transition-colors"
                  aria-label="Upload avatar"
                >
                  <Camera size={14} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                </label>
              )}
            </div>

            {editing ? (
              <div className="w-full flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-text">Full Name</label>
                  <Input
                    value={profile.name}
                    onChange={(e) => handleProfileChange("name", e.target.value)}
                    className="w-full focus:!border-user-teal-start"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-text">Job Title</label>
                  <Input
                    value={profile.title}
                    onChange={(e) => handleProfileChange("title", e.target.value)}
                    className="w-full focus:!border-user-teal-start"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-text">Company</label>
                  <Input
                    value={profile.companyName}
                    onChange={(e) => handleProfileChange("companyName", e.target.value)}
                    className="w-full focus:!border-user-teal-start"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-body-text mt-3">{profile.name}</h2>
                <p className="text-sm text-muted-text">{profile.title}</p>
              </>
            )}

            <div className="w-full border-t border-border/40 mt-4 pt-4 flex flex-col gap-3 text-left">
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Mail size={16} />
                {user?.email}
              </span>
              {profile.companyName && (
                <span className="flex items-center gap-2.5 text-sm text-muted-text">
                  <Building2 size={16} />
                  {profile.companyName}
                </span>
              )}
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Calendar size={16} />
                Member since{" "}
                {user
                  ? new Date(user.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : ""}
              </span>
            </div>

            <Button variant="ghost" className="w-full mt-4" onClick={handleToggleEdit}>
              {editing ? "Cancel Editing" : "Edit Profile"}
            </Button>

            {editing && (
              <Button
                onClick={handleToggleEdit}
                className="!bg-gradient-to-r !from-user-teal-start !to-user-teal-end w-full mt-3"
              >
                Save
              </Button>
            )}
          </Card>

          <div className="bg-gradient-to-br from-user-teal-start to-user-teal-end rounded-card p-6 text-white flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Trophy size={18} />
              <span className="font-semibold">Certifications</span>
            </div>
            <p className="text-4xl font-extrabold mt-2">
              {earnedCertIds.size}
              <span className="text-lg font-medium text-white/70"> / {catalog?.length ?? 0}</span>
            </p>
            <p className="text-sm font-medium">Certifications earned</p>
            <p className="text-xs text-white/80 italic mt-2">
              Earn certifications as needed to access specific spaces and equipment
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Award size={18} className="text-body-text" />
              <h2 className="text-lg font-semibold text-body-text">Proficiency Badges</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {(catalog ?? []).map((certificate) => (
                <CertBadge
                  key={certificate.id}
                  certificate={certificate}
                  earned={earnedCertIds.has(certificate.id)}
                  onSelect={(cert) => setSelectedCertId(cert.id)}
                />
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-body-text mb-2">Training Tutorials &amp; Sessions</h2>
            <p className="text-sm text-muted-text">
              Not wired to real data yet — there&apos;s no GET endpoint exposing the training video
              catalog, video-completion tracking, or onsite session/enrollment listing (only enroll and
              status-update exist). Tracked as a backend gap.
            </p>
          </Card>
        </div>
      </div>

      <CertificateDetailModal
        certificate={selectedCertificate}
        credential={selectedCredential ?? null}
        onClose={() => setSelectedCertId(null)}
      />
    </div>
  );
}
