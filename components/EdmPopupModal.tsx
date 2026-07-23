"use client";

import Modal from "@/components/Modal";
import { useCurrentEdmCampaign, useDismissEdmCampaign } from "@/lib/hooks/useEdmCampaign";

// Sprint 6.12 — layout-level mount (app/(user)/layout.tsx,
// app/(supplier)/layout.tsx), same tier as PendingBookingCreditModal /
// AnnouncementBanner. Self-checking: queries GET /api/edm-campaigns/current
// on mount, renders nothing if null (either nothing eligible, or shown too
// recently — see getActiveEdmForUser's trigger-condition comment).
// Dismissable — the close button is the only interaction, no forced click-
// through.
export default function EdmPopupModal() {
  const { data: campaign } = useCurrentEdmCampaign();
  const dismiss = useDismissEdmCampaign();

  return (
    <Modal open={campaign != null} onClose={() => dismiss.mutate()} className="max-w-lg">
      {campaign && (
        // -m-8 cancels Modal's own hardcoded inner p-8 so the image reaches
        // the modal's edges — Modal.tsx is a shared component, not worth
        // adding a padding-variant prop just for this one consumer.
        <div className="-m-8 rounded-card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={campaign.imageUrl} alt="" className="w-full" />
          {campaign.caption && <p className="text-sm text-body-text px-6 py-4">{campaign.caption}</p>}
        </div>
      )}
    </Modal>
  );
}
