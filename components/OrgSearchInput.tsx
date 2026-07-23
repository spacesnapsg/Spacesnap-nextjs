"use client";

import { useEffect, useRef, useState } from "react";
import Input from "@/components/Input";

interface OrgOption {
  id: string;
  name: string;
}

interface OrgSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  searchUrl: string;
  resultsKey: "companies" | "organizations";
  placeholder: string;
  className?: string;
}

// Search-or-create autocomplete: typing filters against the real
// company/organization list (debounced), picking a result fills the exact
// name, and typing a name with no exact match surfaces a "Create new"
// hint — the actual find-or-create resolution happens server-side
// (resolveCompanyMembership/resolveBuyerOrgMembership), this is purely a
// typo-reduction UX aid. Closes the dead "Search for company or Create new"
// signup field flagged in SPRINT_PLAN_NEXTJS_REWRITE.md Sprint 7.1.
export default function OrgSearchInput({
  value,
  onChange,
  searchUrl,
  resultsKey,
  placeholder,
  className = "",
}: OrgSearchInputProps) {
  const [results, setResults] = useState<OrgOption[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = value.trim();

    const handle = setTimeout(async () => {
      if (!trimmed) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`${searchUrl}?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json();
        setResults(Array.isArray(data[resultsKey]) ? data[resultsKey] : []);
      } catch {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [value, searchUrl, resultsKey]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedValue = value.trim();
  const exactMatch = results.some((r) => r.name.toLowerCase() === trimmedValue.toLowerCase());

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full"
      />
      {open && trimmedValue && (results.length > 0 || !exactMatch) && (
        <div className="absolute z-10 mt-1 w-full rounded border border-border bg-background shadow-lg max-h-56 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onChange(r.name);
                setOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-body-text hover:bg-white/5"
            >
              {r.name}
            </button>
          ))}
          {!exactMatch && (
            <div className="px-4 py-2 text-sm text-muted-text border-t border-border">
              Create new &quot;{trimmedValue}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
