import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface QuizAttemptResult {
  id: string;
  userId: string;
  trainingVideoId: string;
  score: number;
  totalQuestions: number;
  passed: boolean;
  createdAt: string;
}

export interface TrainingVideo {
  id: string;
  companyId: string | null;
  companyName?: string | null;
  certificateId: string | null;
  title: string;
  category: string | null;
  description: string | null;
  durationSeconds: number | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  hasQuiz: boolean;
  completionCount: number;
  completedByMe: boolean;
  myLatestQuizAttempt: QuizAttemptResult | null;
}

export function useTrainingVideos(params?: { category?: string }) {
  const query = params?.category ? `?category=${encodeURIComponent(params.category)}` : "";
  return useQuery({
    queryKey: ["training-videos", params?.category ?? "all"],
    queryFn: () => apiFetch<{ trainingVideos: TrainingVideo[] }>(`/api/training-videos${query}`),
    select: (data) => data.trainingVideos,
  });
}

export interface QuizAnswerOption {
  id: string;
  text: string;
  position: number;
}

export interface QuizQuestionForTaking {
  id: string;
  question: string;
  position: number;
  answers: QuizAnswerOption[];
}

export function useTrainingVideoDetail(id: string | null) {
  return useQuery({
    queryKey: ["training-video-detail", id],
    queryFn: () =>
      apiFetch<{ trainingVideo: TrainingVideo; quizQuestions: QuizQuestionForTaking[] }>(`/api/training-videos/${id}`),
    enabled: id !== null,
  });
}

export function useCompleteTrainingVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trainingVideoId: string) =>
      apiFetch<{ completedAt: string }>(`/api/training-videos/${trainingVideoId}/complete`, { method: "POST" }),
    // Both the list (card grid) and the detail (open modal, which reads its
    // own completedByMe via useTrainingVideoDetail — a separate query key)
    // need invalidating, or the modal's own button stays stale after a
    // successful completion until it's closed and reopened.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
      queryClient.invalidateQueries({ queryKey: ["training-video-detail"] });
    },
  });
}

export function useSubmitQuizAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trainingVideoId, answers }: { trainingVideoId: string; answers: { questionId: string; answerId: string }[] }) =>
      apiFetch<{ quizAttempt: QuizAttemptResult; credentialIssued: boolean }>(
        `/api/training-videos/${trainingVideoId}/quiz-attempts`,
        { method: "POST", body: JSON.stringify({ answers }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
      queryClient.invalidateQueries({ queryKey: ["training-video-detail"] });
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
    },
  });
}
