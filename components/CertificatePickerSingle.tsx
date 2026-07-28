"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { useCertificateCatalog } from "@/lib/hooks/useCertificates";

type CertificatePickerAccent = "ca" | "supplier" | "admin";

const ACCENT_STYLES: Record<CertificatePickerAccent, { focus: string; chip: string; selectedRow: string }> = {
  ca: {
    focus: "focus:border-ca-emerald-start",
    chip: "bg-ca-emerald-start/15 text-ca-emerald-end border-ca-emerald-start/30",
    selectedRow: "bg-ca-emerald-start/15 text-ca-emerald-end",
  },
  supplier: {
    focus: "focus:border-supplier-purple-start",
    chip: "bg-supplier-purple-start/15 text-supplier-purple-end border-supplier-purple-start/30",
    selectedRow: "bg-supplier-purple-start/15 text-supplier-purple-end",
  },
  admin: {
    focus: "focus:border-admin-red-start",
    chip: "bg-admin-red-start/15 text-admin-orange-end border-admin-red-start/30",
    selectedRow: "bg-admin-red-start/15 text-admin-orange-end",
  },
};

interface CertificatePickerSingleProps {
  value: string | null;
  onChange: (certificateId: string) => void;
  accent?: CertificatePickerAccent;
  // Restricts the list to one earningMethod (e.g. "tier1_video_quiz" for the
  // training-video forms) — mirrors CreateSessionModal's own client-side
  // `earningMethod === "tier2b_operator_or_sme_signoff"` filter, so a picker
  // never offers a certificate the server will reject anyway (see
  // assertCertificateEligibleForVideo / createTrainingSession's own check).
  // Omitted for the internal-training-event flow, which accepts any
  // approved certificate regardless of earning method.
  earningMethodFilter?: string;
}

// Single-select certificate picker — built for the CA's internal training
// event create flow (adapted from AddEditListingModal.tsx's multi-select
// certificate picker, same search-box/scrollable-list UX), then reused by the
// supplier/admin training-video forms (session: certificate-picker-for-
// training-videos) since both need the same "pick one approved certificate,
// mandatory" UX, just in different accent colors. Filtered to approved
// certificates only in both cases — CAs and video authors pick from the
// pool, they never author definitions — mirrors
// InternalTrainingCertificateNotApprovedError's own rule, so the client-side
// filter and the server-side rejection agree.
export default function CertificatePickerSingle({
  value,
  onChange,
  accent = "ca",
  earningMethodFilter,
}: CertificatePickerSingleProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: catalog } = useCertificateCatalog();
  const containerRef = useRef<HTMLDivElement>(null);
  const styles = ACCENT_STYLES[accent];

  // Same absolutely-positioned-dropdown-covers-what-follows-it concern as
  // ParticipantPicker — closes on outside click, not just on selection.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const approvedCertificates = (catalog ?? []).filter(
    (c) => c.status === "approved" && (!earningMethodFilter || c.earningMethod === earningMethodFilter)
  );
  const filtered = approvedCertificates.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = approvedCertificates.find((c) => c.id === value) ?? null;

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs text-muted-text">Certificate</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full mt-1.5 min-h-11 bg-background border border-border/40 rounded px-3 py-2 flex items-center gap-1.5 text-left focus:outline-none transition-colors ${styles.focus}`}
      >
        {selected ? (
          <span className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs ${styles.chip}`}>
            {selected.icon} {selected.name}
          </span>
        ) : (
          <span className="text-muted-text text-sm px-1">Select a certificate...</span>
        )}
      </button>

      {open && (
        <div className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded p-2 flex flex-col gap-2 shadow-lg">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-text" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search approved certificates..."
              className={`w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none transition-colors ${styles.focus}`}
            />
          </div>

          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-text px-3 py-2">No approved certificates match.</p>
            ) : (
              filtered.map((cert) => {
                const isSelected = cert.id === value;
                return (
                  <button
                    key={cert.id}
                    type="button"
                    onClick={() => {
                      onChange(cert.id);
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between text-left text-sm rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? styles.selectedRow : "text-body-text hover:bg-background"
                    }`}
                  >
                    <span>
                      {cert.icon} {cert.name}
                    </span>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
