import { CheckCircle2, XCircle, Clock, type LucideIcon } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import {
  useUpdateEnrollmentStatus,
  type SupplierTrainingSession,
  type SupplierTrainingSessionParticipant,
} from "@/lib/hooks/useSupplierTrainingSessions";
import type { TrainingEnrollmentStatus } from "@/lib/hooks/useTrainingSessions";

const STATUS_META: Record<TrainingEnrollmentStatus, { label: string; icon: LucideIcon; className: string }> = {
  enrolled: { label: "Enrolled", icon: Clock, className: "text-body-text" },
  waitlisted: { label: "Waitlisted", icon: Clock, className: "text-amber" },
  awaiting_signoff: { label: "Awaiting Sign-off", icon: Clock, className: "text-amber" },
  completed: { label: "Passed", icon: CheckCircle2, className: "text-success-green" },
  cancelled: { label: "Failed / Cancelled", icon: XCircle, className: "text-error-red" },
};

interface ParticipantRowProps {
  participant: SupplierTrainingSessionParticipant;
}

function ParticipantRow({ participant }: ParticipantRowProps) {
  const meta = STATUS_META[participant.status];
  const StatusIcon = meta.icon;
  const updateStatus = useUpdateEnrollmentStatus();

  function setStatus(status: TrainingEnrollmentStatus) {
    updateStatus.mutate({ enrollmentId: participant.enrollmentId, status });
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-border/40 bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-body-text font-medium truncate">{participant.userName}</p>
          <p className="text-xs text-muted-text truncate">{participant.userEmail}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${meta.className}`}>
          <StatusIcon size={14} />
          {meta.label}
        </span>
      </div>

      {participant.status === "waitlisted" && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={updateStatus.isPending}
            onClick={() => setStatus("enrolled")}
            className="h-8 px-3 text-xs !border-supplier-purple-start !text-supplier-purple-end"
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            disabled={updateStatus.isPending}
            onClick={() => setStatus("cancelled")}
            className="h-8 px-3 text-xs"
          >
            Reject
          </Button>
        </div>
      )}

      {(participant.status === "enrolled" || participant.status === "awaiting_signoff") && (
        <div className="flex items-center gap-2">
          {participant.status === "enrolled" && (
            <Button
              variant="ghost"
              disabled={updateStatus.isPending}
              onClick={() => setStatus("awaiting_signoff")}
              className="h-8 px-3 text-xs"
            >
              Awaiting Sign-off
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={updateStatus.isPending}
            onClick={() => setStatus("completed")}
            className="h-8 px-3 text-xs !border-success-green !text-success-green"
          >
            Pass
          </Button>
          <Button
            variant="ghost"
            disabled={updateStatus.isPending}
            onClick={() => setStatus("cancelled")}
            className="h-8 px-3 text-xs !border-error-red !text-error-red"
          >
            Fail
          </Button>
        </div>
      )}
    </div>
  );
}

interface ViewNamelistModalProps {
  session: SupplierTrainingSession | null;
  onClose: () => void;
}

export default function ViewNamelistModal({ session, onClose }: ViewNamelistModalProps) {
  return (
    <Modal open={!!session} onClose={onClose} className="max-w-[520px]">
      {session && (
        <>
          <h2 className="text-xl font-semibold text-body-text mb-1">Enrolled Participants</h2>
          <p className="text-sm text-muted-text mb-6">
            {session.title}
            {session.certificateName ? ` · ${session.certificateName}` : ""}
          </p>

          {session.participants.length > 0 ? (
            <div className="flex flex-col gap-2">
              {session.participants.map((participant) => (
                <ParticipantRow key={participant.enrollmentId} participant={participant} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-text">No one has enrolled yet.</p>
          )}
        </>
      )}
    </Modal>
  );
}
