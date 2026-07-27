"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useBuyerOrgMembers } from "@/lib/hooks/useBuyerOrganization";

interface ParticipantPickerProps {
  value: string[];
  onChange: (userIds: string[]) => void;
  // The acting CA's own id plus any userId already added to the event —
  // callers are expected to pass both so they never appear as options here.
  // Excluding self at the UI layer mirrors SelfSignoffNotAllowedError so the
  // reason is visible up front instead of discovered via a 422.
  excludeUserIds: string[];
}

// Multi-select-with-chips participant picker, adapted from
// AddEditListingModal.tsx's certificate-picker UX, over
// useBuyerOrgMembers() — already scoped server-side to the CA's own
// organization (requireBuyerOrgMember()), so no client-side org filtering
// is needed beyond the exclusions passed in.
export default function ParticipantPicker({ value, onChange, excludeUserIds }: ParticipantPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: members } = useBuyerOrgMembers();
  const containerRef = useRef<HTMLDivElement>(null);

  // The dropdown is absolutely positioned, so without this it visually (and
  // for clicks) covers whatever follows it in the page — e.g. an "Add
  // Selected" button directly below — until the trigger is clicked again.
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

  const excluded = new Set(excludeUserIds);
  const options = (members ?? []).filter((m) => !excluded.has(m.id));
  const filtered = options.filter(
    (m) =>
      m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      m.email.toLowerCase().includes(search.trim().toLowerCase())
  );

  function toggle(userId: string) {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
  }

  const selectedMembers = (members ?? []).filter((m) => value.includes(m.id));

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs text-muted-text">Participants</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full mt-1.5 min-h-11 bg-background border border-border/40 rounded px-3 py-2 flex flex-wrap items-center gap-1.5 text-left focus:outline-none focus:border-ca-emerald-start transition-colors"
      >
        {selectedMembers.length === 0 ? (
          <span className="text-muted-text text-sm px-1">Select participants...</span>
        ) : (
          selectedMembers.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1 bg-ca-emerald-start/15 text-ca-emerald-end border border-ca-emerald-start/30 rounded-full px-2.5 py-1 text-xs"
            >
              {member.name}
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(member.id);
                }}
                className="hover:text-error-red transition-colors cursor-pointer"
              >
                <X size={10} />
              </span>
            </span>
          ))
        )}
      </button>
      <p className="text-xs text-muted-text mt-1.5">
        You can&apos;t add yourself as a participant on an event you sign off.
      </p>

      {open && (
        <div className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded p-2 flex flex-col gap-2 shadow-lg">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-text" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members by name or email..."
              className="w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-ca-emerald-start transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-text px-3 py-2">No members match.</p>
            ) : (
              filtered.map((member) => {
                const isSelected = value.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggle(member.id)}
                    className={`flex flex-col items-start text-left text-sm rounded-lg px-3 py-2 transition-colors ${
                      isSelected ? "bg-ca-emerald-start/15 text-ca-emerald-end" : "text-body-text hover:bg-background"
                    }`}
                  >
                    <span>{member.name}</span>
                    <span className="text-xs text-muted-text">{member.email}</span>
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
