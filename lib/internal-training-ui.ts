// Pure UI-decision logic for the internal training sign-off screens
// (session: feat/internal-training-ui). No DB/session dependency, same
// "unit-testable without a DB" pattern as lib/credential-provenance.ts.

export type InternalTrainingParticipantStatus = "pending_evidence" | "awaiting_signoff" | "passed" | "failed";
export type ParticipantReviewDecision = "pass" | "fail";

export interface ReviewableParticipant {
  status: InternalTrainingParticipantStatus;
  hasEvidence: boolean;
}

// Mirrors reviewParticipant's own guard order in lib/internal-training-events.ts
// (ParticipantAlreadyReviewedError checked before EvidenceRequiredForPassError)
// so the UI's disabled reason never contradicts what the server would say.
export function getReviewDisabledReason(
  participant: ReviewableParticipant,
  decision: ParticipantReviewDecision
): string | null {
  if (participant.status === "passed" || participant.status === "failed") {
    return "This participant has already been reviewed.";
  }
  if (decision === "pass" && !participant.hasEvidence) {
    return "Upload evidence before this participant can be passed.";
  }
  return null;
}

export interface QueueableParticipant {
  id: string;
  userId: string;
  status: InternalTrainingParticipantStatus;
}

export interface QueueableEvent {
  id: string;
  title: string;
  participants?: QueueableParticipant[];
}

export interface SignoffQueueRow {
  eventId: string;
  eventTitle: string;
  participantId: string;
  userId: string;
}

// The CA sign-off queue has no dedicated backend endpoint — it's derived
// client-side from listOrgEvents' already-embedded participants (see
// lib/internal-training-events.ts's eventWithParticipantsArgs). Pure so it's
// unit-testable without mocking react-query.
export function buildSignoffQueue(events: QueueableEvent[]): SignoffQueueRow[] {
  const rows: SignoffQueueRow[] = [];
  for (const event of events) {
    for (const participant of event.participants ?? []) {
      if (participant.status === "awaiting_signoff") {
        rows.push({
          eventId: event.id,
          eventTitle: event.title,
          participantId: participant.id,
          userId: participant.userId,
        });
      }
    }
  }
  return rows;
}
