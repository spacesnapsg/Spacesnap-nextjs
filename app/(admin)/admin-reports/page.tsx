"use client";

import { useState } from "react";
import { FileBarChart, Download } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRangeFilter } from "@/lib/hooks/useDateRangeFilter";

export default function AdminReportsPage() {
  const { preset, from, to, changePreset, changeFrom, changeTo } = useDateRangeFilter("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/admin/reports/booking-activity?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to generate report.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      link.download = filenameMatch?.[1] ?? "booking-activity-report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Reports
        </h1>
        <p className="text-muted-text mt-1">Platform reporting for admins.</p>
      </div>

      <Card>
        <div className="flex items-start gap-4">
          <span className="h-10 w-10 shrink-0 rounded-full bg-admin-red-start/10 flex items-center justify-center">
            <FileBarChart size={18} className="text-admin-orange-end" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-body-text">Booking Activity Report</h2>
            <p className="text-sm text-muted-text mt-1">
              Total bookings, who booked, what was booked, duration, and total credits for a date range.
            </p>

            <div className="mt-4">
              <DateRangePicker
                preset={preset}
                from={from}
                to={to}
                onPresetChange={changePreset}
                onFromChange={changeFrom}
                onToChange={changeTo}
              />
            </div>

            {error && <p className="text-sm text-admin-red-start mt-3">{error}</p>}

            <Button onClick={handleGenerate} disabled={isGenerating} className="mt-4">
              <Download size={16} className="mr-2" />
              {isGenerating ? "Generating…" : "Generate PDF"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
