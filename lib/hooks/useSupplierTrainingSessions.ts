import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { TrainingEnrollmentStatus, DerivedSessionStatus } from "@/lib/hooks/useTrainingSessions";

export interface SupplierTrainingSessionParticipant {
  enrollmentId: string;
  userName: string;
  userEmail: string;
  status: TrainingEnrollmentStatus;
}

export interface SupplierTrainingSession {
  id: string;
  title: string;
  description: string | null;
  smeName: string;
  sessionDatetime: string;
  location: string | null;
  endorsementName: string | null;
  capacity: number;
  enrolledCount: number;
  derivedStatus: DerivedSessionStatus;
  certificateId: string | null;
  certificateName: string | null;
  participants: SupplierTrainingSessionParticipant[];
}

export function useSupplierTrainingSessions() {
  return useQuery({
    queryKey: ["supplier-training-sessions"],
    queryFn: () => apiFetch<{ trainingSessions: SupplierTrainingSession[] }>("/api/supplier/training-sessions"),
    select: (data) => data.trainingSessions,
  });
}

export interface CreateTrainingSessionInput {
  title: string;
  certificateId: string;
  sessionDatetime: string;
  location?: string;
  capacity: number;
  smeName: string;
  description?: string;
  endorsementName?: string;
}

export function useCreateTrainingSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTrainingSessionInput) =>
      apiFetch<{ trainingSession: SupplierTrainingSession }>("/api/supplier/training-sessions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-training-sessions"] }),
  });
}

// Drives every namelist action: Approve (waitlisted -> enrolled), Awaiting
// Sign-off, Pass (-> completed), Fail/Reject (-> cancelled). The lib layer
// (updateEnrollmentStatus) is what actually enforces which transitions are
// legal — this hook just calls the one shared PATCH route.
export function useUpdateEnrollmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enrollmentId, status }: { enrollmentId: string; status: TrainingEnrollmentStatus }) =>
      apiFetch<{ trainingEnrollment: { id: string; status: TrainingEnrollmentStatus } }>(
        `/api/training-enrollments/${enrollmentId}`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-training-sessions"] }),
  });
}
