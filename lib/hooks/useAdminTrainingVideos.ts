import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { TrainingVideoInput, QuizQuestionInput } from "@/lib/hooks/useSupplierTrainingVideos";

export interface AdminTrainingVideo {
  id: string;
  companyId: string | null;
  companyName?: string | null;
  title: string;
  category: string | null;
  description: string | null;
  durationSeconds: number | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  hasQuiz: boolean;
  completionCount: number;
}

export function useAdminTrainingVideos(params?: { category?: string }) {
  const query = params?.category ? `?category=${encodeURIComponent(params.category)}` : "";
  return useQuery({
    queryKey: ["admin-training-videos", params?.category ?? "all"],
    queryFn: () => apiFetch<{ trainingVideos: AdminTrainingVideo[] }>(`/api/admin/training-videos${query}`),
    select: (data) => data.trainingVideos,
  });
}

export function useAdminCreateTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TrainingVideoInput) =>
      apiFetch<{ trainingVideo: AdminTrainingVideo }>("/api/admin/training-videos", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] }),
  });
}

export function useAdminUpdateTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TrainingVideoInput> & { id: string }) =>
      apiFetch<{ trainingVideo: AdminTrainingVideo }>(`/api/admin/training-videos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] }),
  });
}

export function useAdminDeleteTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/training-videos/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] }),
  });
}

export function useAdminSaveTrainingVideoQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trainingVideoId, questions }: { trainingVideoId: string; questions: QuizQuestionInput[] }) =>
      apiFetch(`/api/admin/training-videos/${trainingVideoId}/quiz-questions`, {
        method: "POST",
        body: JSON.stringify({ questions }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] }),
  });
}
