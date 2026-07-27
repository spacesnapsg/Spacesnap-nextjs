"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { useCertificateCatalog } from "@/lib/hooks/useCertificates";

interface CertificatePickerSingleProps {
  value: string | null;
  onChange: (certificateId: string) => void;
}

// Single-select certificate picker for the CA's internal training event
// create flow — adapted from AddEditListingModal.tsx's multi-select
// certificate picker (same search-box/scrollable-list UX), but filtered to
// approved certificates only. CAs pick from the pool, they never author
// definitions — mirrors InternalTrainingCertificateNotApprovedError's own
// rule, so the client-side filter and the server-side rejection agree.
export default function CertificatePickerSingle({ value, onChange }: CertificatePickerSingleProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: catalog } = useCertificateCatalog();
  const containerRef = useRef<HTMLDivElement>(null);

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

  const approvedCertificates = (catalog ?? []).filter((c) => c.status === "approved");
  const filtered = approvedCertificates.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = approvedCertificates.find((c) => c.id === value) ?? null;

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs text-muted-text">Certificate</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full mt-1.5 min-h-11 bg-background border border-border/40 rounded px-3 py-2 flex items-center gap-1.5 text-left focus:outline-none focus:border-ca-emerald-start transition-colors"
      >
        {selected ? (
          <span className="inline-flex items-center gap-1.5 bg-ca-emerald-start/15 text-ca-emerald-end border border-ca-emerald-start/30 rounded-full px-2.5 py-1 text-xs">
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
              className="w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-ca-emerald-start transition-colors"
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
                      isSelected ? "bg-ca-emerald-start/15 text-ca-emerald-end" : "text-body-text hover:bg-background"
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
