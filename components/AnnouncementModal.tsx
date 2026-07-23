import Modal from "@/components/Modal";
import type { Announcement } from "@/lib/hooks/useAnnouncements";

interface AnnouncementModalProps {
  announcement: Announcement | null;
  onClose: () => void;
}

// The one notification-panel row type that opens a modal on click instead
// of just marking itself read inline — per the product decision, a
// broadcast's full content deserves more room than the panel's compact list
// item shows.
export default function AnnouncementModal({ announcement, onClose }: AnnouncementModalProps) {
  return (
    <Modal open={announcement !== null} onClose={onClose} className="max-w-md">
      {announcement && (
        <>
          {announcement.title && <h2 className="text-xl font-semibold text-body-text mb-2">{announcement.title}</h2>}
          <p className="text-sm text-body-text whitespace-pre-wrap">{announcement.message}</p>
        </>
      )}
    </Modal>
  );
}
