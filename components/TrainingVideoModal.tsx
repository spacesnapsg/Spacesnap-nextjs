"use client";

// TODO: still on mock data (lib/mockTutorials.ts) — waiting on this stack's port of
// the old TrainingVideoController (shared by admin + supplier video CRUD).
import { useState, type FormEvent, type ReactNode } from "react";
import Modal from "./Modal";
import QuizBuilderStep from "./QuizBuilderStep";
import type { QuizQuestion } from "@/lib/mockTutorials";

export interface VideoFormRenderProps<TValues> {
  values: TValues;
  updateField: <K extends keyof TValues>(field: K, value: TValues[K]) => void;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  error: string;
  isEdit: boolean;
}

interface TrainingVideoModalProps<TValues, TSaved extends { id: number }> {
  open: boolean;
  onClose: () => void;
  initialVideo?: { id: number } | null;
  initialFormValues: TValues;
  saveVideo: (values: TValues, videoId: number | null) => Promise<TSaved>;
  saveQuiz: (videoId: number, questions: QuizQuestion[]) => Promise<void>;
  onVideoSaved?: (saved: TSaved) => void;
  onQuizSaved?: (videoId: number, questions: QuizQuestion[]) => void;
  renderVideoForm: (props: VideoFormRenderProps<TValues>) => ReactNode;
  modalClassName?: string;
  accentClassName?: string;
  saveButtonClassName?: string;
}

/**
 * Shared two-step "Add/Edit Training Video" flow: step 1 collects video
 * metadata via a role-specific form (renderVideoForm), step 2 reuses
 * QuizBuilderStep. Callers own the actual save calls and field layouts,
 * since those differ between supplier and admin.
 */
export default function TrainingVideoModal<TValues, TSaved extends { id: number }>({
  open,
  onClose,
  initialVideo = null,
  initialFormValues,
  saveVideo,
  saveQuiz,
  onVideoSaved,
  onQuizSaved,
  renderVideoForm,
  modalClassName = "w-full max-w-[560px]",
  accentClassName = "accent-supplier-purple-start",
  saveButtonClassName = "",
}: TrainingVideoModalProps<TValues, TSaved>) {
  const isEdit = !!initialVideo;
  const [step, setStep] = useState<"video" | "quiz">("video");
  const [values, setValues] = useState<TValues>(initialFormValues);
  const [videoId, setVideoId] = useState<number | null>(initialVideo?.id ?? null);
  const [videoSaving, setVideoSaving] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizError, setQuizError] = useState("");

  // Reset all step/form/quiz state whenever the modal transitions into the
  // open state (fresh create, or editing a different video) — done during
  // render, per React's "adjusting state when a prop changes" pattern,
  // rather than in an effect.
  const resetKey = open ? `open:${initialVideo?.id ?? "new"}` : "closed";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setStep("video");
      setValues(initialFormValues);
      setVideoId(initialVideo?.id ?? null);
      setVideoSaving(false);
      setVideoError("");
      setQuestions([]);
      setQuizSaving(false);
      setQuizError("");
    }
  }

  function updateField<K extends keyof TValues>(field: K, value: TValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmitVideo(e: FormEvent) {
    e.preventDefault();
    setVideoError("");
    setVideoSaving(true);
    try {
      const saved = await saveVideo(values, videoId);
      onVideoSaved?.(saved);
      setVideoSaving(false);
      if (isEdit) {
        onClose();
        return;
      }
      setVideoId(saved.id);
      setStep("quiz");
    } catch (err) {
      setVideoSaving(false);
      setVideoError(err instanceof Error ? err.message : "Could not save the video. Please try again.");
    }
  }

  function handleBack() {
    setStep("video");
  }

  async function handleSaveQuiz(finalQuestions: QuizQuestion[]) {
    setQuestions(finalQuestions);
    setQuizSaving(true);
    setQuizError("");
    try {
      if (videoId === null) throw new Error("Missing video id.");
      await saveQuiz(videoId, finalQuestions);
      onQuizSaved?.(videoId, finalQuestions);
      onClose();
    } catch (err) {
      setQuizError(
        err instanceof Error
          ? err.message
          : "Could not save the quiz. Your questions are still here — please try again."
      );
    } finally {
      setQuizSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} className={modalClassName}>
      {step === "video" ? (
        renderVideoForm({
          values,
          updateField,
          onSubmit: handleSubmitVideo,
          saving: videoSaving,
          error: videoError,
          isEdit,
        })
      ) : (
        <QuizBuilderStep
          questions={questions}
          onChange={setQuestions}
          onBack={handleBack}
          onSave={handleSaveQuiz}
          saving={quizSaving}
          saveError={quizError}
          accentClassName={accentClassName}
          saveButtonClassName={saveButtonClassName}
        />
      )}
    </Modal>
  );
}
