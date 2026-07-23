"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// Shared numbered pager — first built for the Recent Activity feeds
// (user dashboard, org Overview tab), 2026-07-23. No prior pagination UI
// existed anywhere in this codebase (server-side page/skip/take was already
// established, e.g. GET /api/admin/users, but nothing ever rendered page
// controls for it — see that route's own comment). Windows to at most 5
// numbered buttons around the current page so it doesn't grow unbounded
// against a large total.
export default function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

  return (
    <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-border/40">
      <p className="text-xs text-muted-text">
        Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-text hover:text-body-text disabled:opacity-30 disabled:hover:text-muted-text transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        {windowStart > 1 && <span className="text-xs text-muted-text px-1">…</span>}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`h-7 min-w-[28px] px-1.5 rounded text-xs font-medium transition-colors ${
              p === page ? "bg-user-teal-end text-white" : "text-muted-text hover:text-body-text"
            }`}
          >
            {p}
          </button>
        ))}
        {windowEnd < totalPages && <span className="text-xs text-muted-text px-1">…</span>}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-text hover:text-body-text disabled:opacity-30 disabled:hover:text-muted-text transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
