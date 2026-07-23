"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useAdminAnnouncements, useAdminSendAnnouncement } from "@/lib/hooks/useAdminAnnouncements";
import { ApiRequestError } from "@/lib/api-client";
import AdminBanners from "@/components/AdminBanners";
import AdminEdmCampaign from "@/components/AdminEdmCampaign";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" });
}

// Sprint 6.12 — composer + send history for the admin broadcast feature.
// Audience is two independent checkboxes chosen per send (not two separate
// "send to Members" / "send to Suppliers" actions) — see Announcement's own
// schema comment for why.
function BroadcastsTab() {
  const { data: history, isLoading } = useAdminAnnouncements();
  const send = useAdminSendAnnouncement();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetMembers, setTargetMembers] = useState(true);
  const [targetSuppliers, setTargetSuppliers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSend() {
    setError(null);
    send.mutate(
      { title: title.trim() || null, message: message.trim(), targetMembers, targetSuppliers },
      {
        onSuccess: () => {
          setTitle("");
          setMessage("");
        },
        onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Failed to send broadcast."),
      }
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-base font-semibold text-body-text mb-4">New Broadcast</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-muted-text">Title (optional)</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full" />
          </div>
          <div>
            <label className="text-xs text-muted-text">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mt-1.5 w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-admin-red-start transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-text block mb-1.5">Audience</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-body-text cursor-pointer">
                <input type="checkbox" checked={targetMembers} onChange={(e) => setTargetMembers(e.target.checked)} />
                Members
              </label>
              <label className="flex items-center gap-2 text-sm text-body-text cursor-pointer">
                <input type="checkbox" checked={targetSuppliers} onChange={(e) => setTargetSuppliers(e.target.checked)} />
                Suppliers
              </label>
            </div>
          </div>
          {error && <p className="text-xs text-error-red">{error}</p>}
          <Button
            onClick={handleSend}
            disabled={send.isPending || message.trim().length === 0 || (!targetMembers && !targetSuppliers)}
            className="self-start mt-1"
          >
            <Send size={16} className="mr-2" />
            {send.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-body-text mb-4">Send History</h3>
        {isLoading ? (
          <p className="text-sm text-muted-text">Loading…</p>
        ) : !history || history.length === 0 ? (
          <p className="text-sm text-muted-text">No broadcasts sent yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 max-h-[480px] overflow-y-auto">
            {history.map((a) => (
              <li key={a.id} className="border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
                {a.title && <p className="text-sm font-semibold text-body-text">{a.title}</p>}
                <p className="text-sm text-muted-text">{a.message}</p>
                <p className="text-xs text-hint-text mt-1">
                  {[a.targetMembers && "Members", a.targetSuppliers && "Suppliers"].filter(Boolean).join(" · ")} —{" "}
                  {formatDateTime(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type MainTab = "broadcasts" | "banners" | "edm";

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "broadcasts", label: "Broadcasts" },
  { id: "banners", label: "Banners" },
  { id: "edm", label: "EDM Popup" },
];

const TAB_DESCRIPTIONS: Record<MainTab, string> = {
  broadcasts: "Send a notification to every Member and/or Supplier account.",
  banners: "Configure the persistent banner shown below the navbar in each portal.",
  edm: "Configure the popup shown on sign-in (and again after 6+ hours idle).",
};

export default function AdminBroadcasts() {
  const [activeTab, setActiveTab] = useState<MainTab>("broadcasts");

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Broadcasts
        </h1>
        <p className="text-muted-text mt-1">{TAB_DESCRIPTIONS[activeTab]}</p>
      </div>

      <div className="inline-flex bg-card border border-border rounded-full p-1 gap-1 w-fit mb-6">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white" : "text-muted-text hover:text-body-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "broadcasts" ? <BroadcastsTab /> : activeTab === "banners" ? <AdminBanners /> : <AdminEdmCampaign />}
    </div>
  );
}
