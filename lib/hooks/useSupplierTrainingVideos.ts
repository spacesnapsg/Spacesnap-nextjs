import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { TrainingVideo } from "@/lib/hooks/useTrainingVideos";

export interface TrainingVideoInput {
  title: string;
  category: string;
  description?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
}

// Suppliers browse the same platform-wide catalog everyone else sees
// (useTrainingVideos) — there's no supplier-scoped "my videos" list in this
// app, matching the old backend (no supplierIndex route ever existed). These
// mutations just add to / edit within that shared catalog.
export function useCreateTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TrainingVideoInput) =>
      apiFetch<{ trainingVideo: TrainingVideo }>("/api/supplier/training-videos", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-videos"] }),
  });
}

export function useUpdateTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TrainingVideoInput> & { id: string }) =>
      apiFetch<{ trainingVideo: TrainingVideo }>(`/api/supplier/training-videos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-videos"] }),
  });
}

export interface QuizQuestionInput {
  question: string;
  options: string[];
  correctIndex: number;
}

export function useSaveTrainingVideoQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trainingVideoId, questions }: { trainingVideoId: string; questions: QuizQuestionInput[] }) =>
      apiFetch(`/api/supplier/training-videos/${trainingVideoId}/quiz-questions`, {
        method: "POST",
        body: JSON.stringify({ questions }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["training-videos"] }),
  });
}
