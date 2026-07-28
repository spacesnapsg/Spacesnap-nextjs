import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface InternalTrainingParticipant {
  id: string;
  eventId: string;
  userId: string;
  hasEvidence: boolean;
  uploadedByUserId: string | null;
  status: "pending_evidence" | "awaiting_signoff" | "passed" | "failed";
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InternalTrainingEvent {
  id: string;
  buyerOrganizationId: string;
  createdByUserId: string;
  certificateId: string;
  certificateName?: string;
  title: string;
  trainingDate: string;
  equipmentDetails: string;
  trainerName: string;
  status: "submitted" | "completed";
  participants?: InternalTrainingParticipant[];
  createdAt: string;
  updatedAt: string;
}

const ORG_EVENTS_KEY = ["internal-training-events", "org"] as const;
const MY_EVENTS_KEY = ["internal-training-events", "mine"] as const;

// Participant-side: every event the caller has a participant row on,
// regardless of which organization created it — see
// GET /api/internal-training-events.
export function useMyInternalTrainingEvents() {
  return useQuery({
    queryKey: MY_EVENTS_KEY,
    queryFn: () => apiFetch<{ events: InternalTrainingEvent[] }>("/api/internal-training-events"),
    select: (data) => data.events,
  });
}

// CA-side: every event created within the CA's own BuyerOrganization — see
// GET /api/buyer-organization/internal-training-events. Already embeds all
// participants per event (lib/internal-training-events.ts's
// eventWithParticipantsArgs), so both the CA dashboard and the sign-off
// queue page share this same cache entry with no extra fetch.
export function useOrgInternalTrainingEvents() {
  return useQuery({
    queryKey: ORG_EVENTS_KEY,
    queryFn: () => apiFetch<{ events: InternalTrainingEvent[] }>("/api/buyer-organization/internal-training-events"),
    select: (data) => data.events,
  });
}

export function useOrgInternalTrainingEvent(eventId: string | null) {
  return useQuery({
    queryKey: ["internal-training-events", "org", eventId],
    queryFn: () => apiFetch<{ event: InternalTrainingEvent }>(`/api/buyer-organization/internal-training-events/${eventId}`),
    select: (data) => data.event,
    enabled: !!eventId,
  });
}

export interface CreateInternalTrainingEventFields {
  title: string;
  trainingDate: string;
  certificateId: string;
  equipmentDetails: string;
  trainerName: string;
}

export function useCreateInternalTrainingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: CreateInternalTrainingEventFields) =>
      apiFetch<{ event: InternalTrainingEvent }>("/api/buyer-organization/internal-training-events", {
        method: "POST",
        body: JSON.stringify(fields),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORG_EVENTS_KEY }),
  });
}

// Takes eventId as a mutate-time argument rather than a hook-call-time
// argument — the create-event flow only learns the eventId after
// createInternalTrainingEvent's own mutation resolves, inside the same
// handler, so a hook bound to a not-yet-set eventId would close over a
// stale value.
export function useAddInternalTrainingParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) =>
      apiFetch<{ participant: InternalTrainingParticipant }>(
        `/api/buyer-organization/internal-training-events/${eventId}/participants`,
        { method: "POST", body: JSON.stringify({ userId }) }
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["internal-training-events", "org", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ORG_EVENTS_KEY });
    },
  });
}

export function useReviewInternalTrainingParticipant(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      participantId,
      decision,
      reviewNote,
    }: {
      participantId: string;
      decision: "pass" | "fail";
      reviewNote?: string | null;
    }) =>
      apiFetch<{ participant: InternalTrainingParticipant }>(
        `/api/buyer-organization/internal-training-events/${eventId}/participants/${participantId}`,
        { method: "PATCH", body: JSON.stringify({ decision, reviewNote }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-training-events", "org", eventId] });
      queryClient.invalidateQueries({ queryKey: ORG_EVENTS_KEY });
    },
  });
}
