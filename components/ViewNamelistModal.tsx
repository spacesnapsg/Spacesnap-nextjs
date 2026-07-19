// TODO: still on mock data (lib/mockTutorials.ts) — waiting on this stack's port of
// the old TrainingSessionController (session namelist/enrollment-listing endpoint).
import { CheckCircle2, XCircle, Clock, type LucideIcon } from "lucide-react";
import Modal from "./Modal";
import type { TrainingSession, ParticipantStatus } from "@/lib/mockTutorials";

const STATUS_META: Record<ParticipantStatus, { label: string; icon: LucideIcon; className: string }> = {
  pass: { label: "Passed", icon: CheckCircle2, className: "text-success-green" },
  fail: { label: "Failed", icon: XCircle, className: "text-error-red" },
  pending: { label: "Pending", icon: Clock, className: "text-muted-text" },
};

interface ViewNamelistModalProps {
  session: TrainingSession | null;
  onClose: () => void;
}

export default function ViewNamelistModal({ session, onClose }: ViewNamelistModalProps) {
  return (
    <Modal open={!!session} onClose={onClose} className="max-w-[520px]">
      {session && (
        <>
          <h2 className="text-xl font-semibold text-body-text mb-1">Enrolled Participants</h2>
          <p className="text-sm text-muted-text mb-6">
            {session.certificate} &middot; {session.listing}
          </p>

          <div className="flex flex-col gap-2">
            {session.enrolledUsers.map((user) => {
              const meta = STATUS_META[user.status];
              const StatusIcon = meta.icon;
              return (
                <div
                  key={user.name}
                  className="flex items-center justify-between rounded border border-border/40 bg-background px-4 py-3"
                >
                  <span className="text-sm text-body-text font-medium">{user.name}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.className}`}>
                    <StatusIcon size={14} />
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
