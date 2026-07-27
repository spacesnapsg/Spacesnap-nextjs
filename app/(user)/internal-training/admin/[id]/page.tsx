"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShieldCheck, Check, X as XIcon, UserPlus } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import EvidenceUploadField from "@/components/EvidenceUploadField";
import ParticipantPicker from "@/components/ParticipantPicker";
import { useBuyerOrgMembers } from "@/lib/hooks/useBuyerOrganization";
import {
  useOrgInternalTrainingEvent,
  useAddInternalTrainingParticipant,
  useReviewInternalTrainingParticipant,
  type InternalTrainingParticipant,
} from "@/lib/hooks/useInternalTrainingEvents";
import { getReviewDisabledReason } from "@/lib/internal-training-ui";
import { ApiRequestError } from "@/lib/api-client";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_evidence: { label: "Evidence Needed", className: "bg-amber/15 text-amber border-amber/30" },
  awaiting_signoff: { label: "Awaiting Sign-off", className: "bg-amber/15 text-amber border-amber/30" },
  passed: { label: "Passed", className: "bg-success-green/15 text-success-green border-success-green/30" },
  failed: { label: "Failed", className: "bg-error-red/15 text-error-red border-error-red/30" },
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ParticipantRow({
  eventId,
  participant,
  name,
  email,
}: {
  eventId: string;
  participant: InternalTrainingParticipant;
  name: string;
  email: string;
}) {
  const [note, setNote] = useState(participant.reviewNote ?? "");
  const review = useReviewInternalTrainingParticipant(eventId);
  const badge = STATUS_BADGE[participant.status];
  const passDisabledReason = getReviewDisabledReason(participant, "pass");
  const failDisabledReason = getReviewDisabledReason(participant, "fail");

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-body-text">{name}</p>
          <p className="text-xs text-muted-text">{email}</p>
        </div>
        {badge && (
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border/40">
        <EvidenceUploadField eventId={eventId} participantId={participant.id} hasEvidence={participant.hasEvidence} />
      </div>

      {participant.status !== "passed" && participant.status !== "failed" && (
        <div className="mt-4 pt-4 border-t border-border/40 flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional review note..."
            rows={2}
            className="w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-3 py-2 text-sm focus:outline-none focus:border-ca-emerald-start transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <div>
              <Button
                onClick={() => review.mutate({ participantId: participant.id, decision: "pass", reviewNote: note || null })}
                disabled={!!passDisabledReason || review.isPending}
                className="!bg-gradient-to-r !from-success-green !to-success-green gap-1.5 h-9 px-4 text-sm disabled:opacity-40"
              >
                <Check size={14} /> Pass
              </Button>
              {passDisabledReason && <p className="text-xs text-muted-text mt-1">{passDisabledReason}</p>}
            </div>
            <div>
              <Button
                variant="ghost"
                onClick={() => review.mutate({ participantId: participant.id, decision: "fail", reviewNote: note || null })}
                disabled={!!failDisabledReason || review.isPending}
                className="gap-1.5 h-9 px-4 text-sm hover:text-error-red disabled:opacity-40"
              >
                <XIcon size={14} /> Fail
              </Button>
              {failDisabledReason && <p className="text-xs text-muted-text mt-1">{failDisabledReason}</p>}
            </div>
          </div>
          {review.isError && (
            <p className="text-xs text-error-red">
              {review.error instanceof ApiRequestError ? review.error.message : "Something went wrong."}
            </p>
          )}
        </div>
      )}

      {participant.reviewNote && (participant.status === "passed" || participant.status === "failed") && (
        <p className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-text">Note: {participant.reviewNote}</p>
      )}
    </Card>
  );
}

export default function InternalTrainingEventDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id;

  const { data: event, isLoading } = useOrgInternalTrainingEvent(eventId);
  const { data: members } = useBuyerOrgMembers();
  const addParticipant = useAddInternalTrainingParticipant();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingUserIds, setPendingUserIds] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && !session?.user.isBuyerOrgAdmin) router.replace("/passport");
  }, [status, session, router]);

  if (status !== "authenticated" || !session?.user.isBuyerOrgAdmin) return null;

  function memberName(userId: string) {
    return members?.find((m) => m.id === userId)?.name ?? userId;
  }
  function memberEmail(userId: string) {
    return members?.find((m) => m.id === userId)?.email ?? "";
  }

  async function handleAddParticipants() {
    setAddError(null);
    const results = await Promise.allSettled(
      pendingUserIds.map((userId) => addParticipant.mutateAsync({ eventId, userId }))
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length === 0) {
      setPendingUserIds([]);
      setAddOpen(false);
    } else {
      setAddError(`${failed.length} of ${pendingUserIds.length} participants could not be added.`);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {isLoading || !event ? (
        <p className="text-sm text-muted-text">Loading…</p>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-body-text">
              <ShieldCheck size={22} className="text-ca-emerald-end" />
              {event.title}
            </h1>
            <p className="text-sm text-muted-text mt-1">
              {event.certificateName ?? "Certificate"} · {formatDate(event.trainingDate)} · Trainer: {event.trainerName}
            </p>
            <p className="text-sm text-muted-text mt-1">{event.equipmentDetails}</p>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-body-text">Participants</h2>
            <Button
              variant="ghost"
              onClick={() => setAddOpen((o) => !o)}
              className="gap-1.5 h-9 px-4 text-sm"
            >
              <UserPlus size={14} /> Add Participants
            </Button>
          </div>

          {addOpen && (
            <Card className="mb-4">
              <ParticipantPicker
                value={pendingUserIds}
                onChange={setPendingUserIds}
                excludeUserIds={[
                  ...(session?.user.id ? [session.user.id] : []),
                  ...(event.participants?.map((p) => p.userId) ?? []),
                ]}
              />
              {addError && <p className="text-sm text-error-red mt-2">{addError}</p>}
              <Button
                onClick={handleAddParticipants}
                disabled={pendingUserIds.length === 0 || addParticipant.isPending}
                className="!bg-gradient-to-r !from-ca-emerald-start !to-ca-emerald-end mt-3"
              >
                {addParticipant.isPending ? "Adding…" : "Add Selected"}
              </Button>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {(event.participants ?? []).length === 0 ? (
              <Card>
                <p className="text-sm text-muted-text">No participants added yet.</p>
              </Card>
            ) : (
              (event.participants ?? []).map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  eventId={event.id}
                  participant={participant}
                  name={memberName(participant.userId)}
                  email={memberEmail(participant.userId)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
