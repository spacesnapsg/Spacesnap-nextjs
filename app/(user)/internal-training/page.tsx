"use client";

import { useSession } from "next-auth/react";
import { GraduationCap } from "lucide-react";
import Card from "@/components/Card";
import EvidenceUploadField from "@/components/EvidenceUploadField";
import { useMyInternalTrainingEvents } from "@/lib/hooks/useInternalTrainingEvents";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_evidence: { label: "Evidence Needed", className: "bg-amber/15 text-amber border-amber/30" },
  awaiting_signoff: { label: "Awaiting Sign-off", className: "bg-amber/15 text-amber border-amber/30" },
  passed: { label: "Passed", className: "bg-success-green/15 text-success-green border-success-green/30" },
  failed: { label: "Failed", className: "bg-error-red/15 text-error-red border-error-red/30" },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Participant-side: every internal training event this user is a
// participant in, from GET /api/internal-training-events (any authenticated
// user, not CA-gated). Shows only their own participant row + evidence
// upload — other participants' details belong on the CA's event page.
export default function MyInternalTrainingsPage() {
  const { data: session } = useSession();
  const { data: events, isLoading } = useMyInternalTrainingEvents();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-body-text mb-6">
        <GraduationCap size={22} />
        My Internal Trainings
      </h1>

      {isLoading ? (
        <p className="text-sm text-muted-text">Loading…</p>
      ) : !events || events.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-text">You aren&apos;t a participant in any internal training events yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => {
            const own = event.participants?.find((p) => p.userId === session?.user.id) ?? null;
            const badge = own ? STATUS_BADGE[own.status] : null;
            return (
              <Card key={event.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-body-text">{event.title}</h2>
                    <p className="text-sm text-muted-text mt-0.5">
                      {event.certificateName ?? "Certificate"} · {formatDate(event.trainingDate)} · Trainer:{" "}
                      {event.trainerName}
                    </p>
                  </div>
                  {badge && (
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </div>

                {own && (own.status === "pending_evidence" || own.status === "awaiting_signoff") && (
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <EvidenceUploadField eventId={event.id} participantId={own.id} hasEvidence={own.hasEvidence} />
                  </div>
                )}

                {own?.status === "failed" && own.reviewNote && (
                  <p className="mt-3 text-xs text-muted-text">Note from your reviewer: {own.reviewNote}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
