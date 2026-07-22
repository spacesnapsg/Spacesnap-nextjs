"use client";

import { Award, Building2, Calendar, MapPin, Users } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useEnrollInTrainingSession, type TrainingSession } from "@/lib/hooks/useTrainingSessions";
import { ApiRequestError } from "@/lib/api-client";

const SESSION_BADGE: Record<string, { label: string; className: string }> = {
  enrolled: { label: "Enrolled", className: "bg-success-green/15 text-success-green border-success-green/30" },
  waitlisted: { label: "Waitlisted", className: "bg-amber/15 text-amber border-amber/30" },
  awaiting_signoff: { label: "Awaiting Sign-off", className: "bg-amber/15 text-amber border-amber/30" },
  completed: { label: "Completed", className: "bg-success-green/15 text-success-green border-success-green/30" },
  cancelled: { label: "Cancelled", className: "bg-error-red/15 text-error-red border-error-red/30" },
  full: { label: "Full", className: "bg-white/10 text-body-text border-white/20" },
  past: { label: "Past", className: "bg-white/10 text-muted-text border-white/20" },
  open: { label: "Open", className: "bg-user-teal-start/15 text-user-teal-end border-user-teal-start/30" },
};

function sessionBadge(session: TrainingSession) {
  return SESSION_BADGE[session.myEnrollmentStatus ?? session.derivedStatus];
}

function sessionActionLabel(session: TrainingSession): { label: string; disabled: boolean } {
  if (session.derivedStatus === "past") return { label: "Session Has Passed", disabled: true };
  switch (session.myEnrollmentStatus) {
    case "enrolled":
      return { label: "Already Enrolled", disabled: true };
    case "waitlisted":
      return { label: "On Waitlist", disabled: true };
    case "awaiting_signoff":
      return { label: "Awaiting Sign-off", disabled: true };
    case "completed":
      return { label: "Completed", disabled: true };
    case "cancelled":
      return { label: "Enrollment Cancelled", disabled: true };
    default:
      return session.derivedStatus === "full"
        ? { label: "Join Waitlist", disabled: false }
        : { label: "Sign Up for this Session", disabled: false };
  }
}

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Shared between the passport page's session browser and the user
// dashboard's Recent Activity feed (a training_enrolled/training_waitlisted/
// training_waitlist_approved row is now clickable and opens this same modal
// via relatedTrainingSessionId — see ActivityRow in app/(user)/user/page.tsx).
export default function TrainingSessionDetailModal({
  session,
  onClose,
}: {
  session: TrainingSession | null;
  onClose: () => void;
}) {
  const enrollMutation = useEnrollInTrainingSession();

  function handleClose() {
    enrollMutation.reset();
    onClose();
  }

  const action = session ? sessionActionLabel(session) : null;
  const badge = session ? sessionBadge(session) : null;

  return (
    <Modal open={!!session} onClose={handleClose} className="max-w-[520px]">
      {session && action && badge && (
        <div className="flex flex-col gap-4 pr-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-user-teal-start/15 text-user-teal-end border border-user-teal-start/30 rounded-full px-2.5 py-1 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-user-teal-start" />
                Onsite Training
              </span>
              <h3 className="font-semibold text-body-text text-lg leading-snug mt-2">{session.title}</h3>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {session.description && <p className="text-sm text-muted-text">{session.description}</p>}

          <div className="border-t border-border/40 pt-4 flex flex-col gap-2 text-sm text-muted-text">
            <span className="flex items-center gap-2">
              <Calendar size={14} />
              {formatSessionDate(session.sessionDatetime)}
            </span>
            {session.location && (
              <span className="flex items-center gap-2">
                <MapPin size={14} />
                {session.location}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Users size={14} />
              {session.enrolledCount} / {session.capacity} enrolled
              {session.waitlistCount > 0 ? ` · ${session.waitlistCount} on waitlist` : ""}
            </span>
            {session.hostCompanyName && (
              <span className="flex items-center gap-2">
                <Building2 size={14} />
                Hosted by: {session.hostCompanyName}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Award size={14} />
              SME: {session.smeName}
            </span>
          </div>

          {session.endorsementName && (
            <div className="border-t border-border/40 pt-4">
              <p className="text-sm font-medium text-body-text mb-1">What you&apos;ll earn</p>
              <p className="text-user-teal-end text-sm font-medium">{session.endorsementName}</p>
              {session.certificateName && (
                <p className="text-xs text-muted-text italic mt-1">Certificate: {session.certificateName}</p>
              )}
            </div>
          )}

          <div className="border-t border-border/40 pt-4">
            <Button
              disabled={action.disabled || enrollMutation.isPending}
              className={`w-full ${action.disabled ? "!bg-none !bg-white/10 !text-muted-text cursor-not-allowed" : "!bg-gradient-to-r !from-user-teal-start !to-user-teal-end"}`}
              onClick={() => enrollMutation.mutate(session.id)}
            >
              {enrollMutation.isPending ? "Submitting…" : action.label}
            </Button>
            {enrollMutation.isError && (
              <p className="text-xs text-error-red mt-2">
                {enrollMutation.error instanceof ApiRequestError
                  ? enrollMutation.error.message
                  : "Something went wrong — please try again."}
              </p>
            )}
            {enrollMutation.isSuccess && (
              <p className="text-xs text-success-green mt-2">
                {enrollMutation.data.trainingEnrollment.status === "waitlisted"
                  ? "You're on the waitlist — the supplier will approve you if a spot opens up."
                  : "You're enrolled!"}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
