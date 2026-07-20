import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type TrainingEnrollmentStatus = "enrolled" | "waitlisted" | "awaiting_signoff" | "completed" | "cancelled";
export type DerivedSessionStatus = "past" | "full" | "open";

export interface TrainingSession {
  id: string;
  title: string;
  description: string | null;
  smeName: string;
  sessionDatetime: string;
  location: string | null;
  endorsementName: string | null;
  capacity: number;
  enrolledCount: number;
  waitlistCount: number;
  derivedStatus: DerivedSessionStatus;
  hostCompanyName: string | null;
  certificateId: string | null;
  certificateName: string | null;
  myEnrollmentStatus: TrainingEnrollmentStatus | null;
}

export function useTrainingSessions() {
  return useQuery({
    queryKey: ["training-sessions"],
    queryFn: () => apiFetch<{ trainingSessions: TrainingSession[] }>("/api/training-sessions"),
    select: (data) => data.trainingSessions,
  });
}

// Never rejects for being full (2026-07-20 product owner decision) — lands
// as `waitlisted` instead of `enrolled` once the session is at capacity.
// The caller reads the result's `trainingEnrollment.status` to know which.
export function useEnrollInTrainingSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trainingSessionId: string) =>
      apiFetch<{ trainingEnrollment: { id: string; status: TrainingEnrollmentStatus } }>("/api/training-enrollments", {
        method: "POST",
        body: JSON.stringify({ trainingSessionId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-sessions"] }),
  });
}
