"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import ImageUploadField from "@/components/ImageUploadField";
import { useAdminBanner, useAdminSetBanner } from "@/lib/hooks/useAdminBanners";
import type { BannerPortal } from "@/lib/hooks/useBanner";

function BannerForm({ portal, label }: { portal: BannerPortal; label: string }) {
  const { data: banner } = useAdminBanner(portal);
  const setBanner = useAdminSetBanner(portal);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    setBanner.mutate(
      { imageKey: pendingKey ?? "", expiresAt: expiresAt || null },
      { onSuccess: () => setSaved(true) }
    );
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-body-text mb-1">{label}</h3>
      <p className="text-xs text-muted-text mb-4">
        {banner ? `Currently set${banner.expiresAt ? `, expires ${new Date(banner.expiresAt).toLocaleDateString()}` : ""}.` : "Not configured."}
      </p>
      <div className="flex flex-col gap-3">
        <ImageUploadField
          uploadUrlEndpoint={`/api/admin/banners/${portal}/upload-url`}
          currentImageUrl={banner?.imageUrl}
          onUploaded={setPendingKey}
        />
        <div>
          <label className="text-xs text-muted-text">Expiry (optional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1.5 w-full bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-admin-red-start transition-colors"
          />
        </div>
        {saved && <p className="text-xs text-success-green">Saved.</p>}
        <Button onClick={handleSave} disabled={setBanner.isPending || !pendingKey} className="self-start">
          {setBanner.isPending ? "Saving…" : "Save Banner"}
        </Button>
      </div>
    </Card>
  );
}

export default function AdminBanners() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <BannerForm portal="member" label="Member Portal Banner" />
      <BannerForm portal="supplier" label="Supplier Portal Banner" />
    </div>
  );
}
