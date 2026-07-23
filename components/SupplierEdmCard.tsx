"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ImageUploadField from "@/components/ImageUploadField";
import { useSupplierEdmCampaign, useSetSupplierEdmCampaign } from "@/lib/hooks/useSupplierEdmCampaign";

// Sprint 6.12 — a supplier's own EDM ad, always shown to Members only (no
// audience picker, unlike the admin slot on /admin-broadcasts). Free/self-
// serve this pass — no payment gate; the "Ads" catalogue placeholder card
// eventually points at this same upload path, not a separate one.
export default function SupplierEdmCard() {
  const { data: campaign } = useSupplierEdmCampaign();
  const setCampaign = useSetSupplierEdmCampaign();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    setCampaign.mutate({ imageKey: pendingKey ?? "", caption: caption.trim() || null }, { onSuccess: () => setSaved(true) });
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-body-text mb-1">EDM Popup (Ad to Members)</h3>
      <p className="text-xs text-muted-text mb-4">
        {campaign ? "Currently set — shows to Members on sign-in." : "Not configured."}
      </p>
      <div className="flex flex-col gap-3">
        <ImageUploadField uploadUrlEndpoint="/api/supplier/edm-campaign/upload-url" currentImageUrl={campaign?.imageUrl} onUploaded={setPendingKey} />
        <div>
          <label className="text-xs text-muted-text">Caption (optional)</label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1.5 w-full" />
        </div>
        {saved && <p className="text-xs text-success-green">Saved.</p>}
        <Button onClick={handleSave} disabled={setCampaign.isPending || !pendingKey} className="self-start">
          {setCampaign.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
