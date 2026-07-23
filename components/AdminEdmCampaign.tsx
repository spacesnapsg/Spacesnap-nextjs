"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ImageUploadField from "@/components/ImageUploadField";
import { useAdminEdmCampaign, useAdminSetEdmCampaign } from "@/lib/hooks/useAdminEdmCampaign";

export default function AdminEdmCampaign() {
  const { data: campaign } = useAdminEdmCampaign();
  const setCampaign = useAdminSetEdmCampaign();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [targetMembers, setTargetMembers] = useState(true);
  const [targetSuppliers, setTargetSuppliers] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    setCampaign.mutate(
      { imageKey: pendingKey ?? "", caption: caption.trim() || null, targetMembers, targetSuppliers },
      { onSuccess: () => setSaved(true) }
    );
  }

  return (
    <Card className="max-w-xl">
      <h3 className="text-base font-semibold text-body-text mb-1">Admin EDM Popup</h3>
      <p className="text-xs text-muted-text mb-4">
        {campaign
          ? `Currently set, targeting ${[campaign.targetMembers && "Members", campaign.targetSuppliers && "Suppliers"].filter(Boolean).join(" & ")}.`
          : "Not configured."}
      </p>
      <div className="flex flex-col gap-3">
        <ImageUploadField uploadUrlEndpoint="/api/admin/edm-campaign/upload-url" currentImageUrl={campaign?.imageUrl} onUploaded={setPendingKey} />
        <div>
          <label className="text-xs text-muted-text">Caption (optional)</label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1.5 w-full" />
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
        {saved && <p className="text-xs text-success-green">Saved.</p>}
        <Button
          onClick={handleSave}
          disabled={setCampaign.isPending || !pendingKey || (!targetMembers && !targetSuppliers)}
          className="self-start"
        >
          {setCampaign.isPending ? "Saving…" : "Save Popup"}
        </Button>
      </div>
    </Card>
  );
}
