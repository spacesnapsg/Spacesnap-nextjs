"use client";

import { useState, type FormEvent } from "react";
import { Video, Image as ImageIcon } from "lucide-react";
import TrainingVideoModal, { type VideoFormRenderProps } from "./TrainingVideoModal";
import Button from "./Button";
import Input from "./Input";
import CertificatePickerSingle from "./CertificatePickerSingle";
import { VIDEO_CATEGORIES, type VideoCategory, type QuizQuestion } from "@/lib/mockTutorials";
import { useCreateTrainingVideo, useSaveTrainingVideoQuiz } from "@/lib/hooks/useSupplierTrainingVideos";

interface SupplierVideoFormValues {
  title: string;
  category: VideoCategory;
  certificateId: string | null;
  description: string;
}

const EMPTY_FORM: SupplierVideoFormValues = {
  title: "",
  category: "Safety",
  certificateId: null,
  description: "",
};

function SupplierVideoFields({
  values,
  updateField,
  onSubmit,
  saving,
  error,
}: VideoFormRenderProps<SupplierVideoFormValues>) {
  const [titleError, setTitleError] = useState("");
  const [certificateError, setCertificateError] = useState("");

  function handleSubmit(e: FormEvent) {
    let hasError = false;
    if (!values.title.trim()) {
      setTitleError("Title is required.");
      hasError = true;
    } else {
      setTitleError("");
    }
    // Every training video must land the viewer a certificate on a passing
    // quiz (no more "informational only" videos authored from this form) —
    // see the CertificateNotEligibleForVideoError comment in
    // lib/training-videos.ts for the matching server-side rule.
    if (!values.certificateId) {
      setCertificateError("Select which certificate this video's quiz awards.");
      hasError = true;
    } else {
      setCertificateError("");
    }
    if (hasError) {
      e.preventDefault();
      return;
    }
    onSubmit(e);
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-body-text mb-6">Upload Video</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-muted-text">Title</label>
          <Input
            value={values.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="e.g. BSL-2 Lab Safety Basics"
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
          {titleError && <p className="text-xs text-error-red mt-1">{titleError}</p>}
        </div>

        <div>
          <label className="text-xs text-muted-text">Category</label>
          <select
            value={values.category}
            onChange={(e) => updateField("category", e.target.value as VideoCategory)}
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-supplier-purple-start transition-colors"
          >
            {VIDEO_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <CertificatePickerSingle
            value={values.certificateId}
            onChange={(certificateId) => updateField("certificateId", certificateId)}
            accent="supplier"
            earningMethodFilter="tier1_video_quiz"
          />
          {certificateError && <p className="text-xs text-error-red mt-1">{certificateError}</p>}
        </div>

        <div>
          <label className="text-xs text-muted-text">Upload Video File</label>
          <label className="mt-1.5 flex items-center justify-center gap-2 h-24 rounded border border-dashed border-border/60 text-muted-text text-sm cursor-not-allowed">
            <Video size={18} />
            Video upload coming soon
            <input type="file" disabled className="hidden" />
          </label>
        </div>

        <div>
          <label className="text-xs text-muted-text">Upload Thumbnail</label>
          <label className="mt-1.5 flex items-center justify-center gap-2 h-24 rounded border border-dashed border-border/60 text-muted-text text-sm cursor-not-allowed">
            <ImageIcon size={18} />
            Thumbnail upload coming soon
            <input type="file" disabled className="hidden" />
          </label>
        </div>

        <div>
          <label className="text-xs text-muted-text">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={3}
            placeholder="Describe what this video covers..."
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-supplier-purple-start transition-colors resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-error-red bg-error-red/10 border border-error-red/30 rounded px-4 py-3">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={saving}
          className="w-full !bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end"
        >
          {saving ? "Saving…" : "Next"}
        </Button>
      </form>
    </>
  );
}

interface SavedVideo {
  id: string;
}

interface UploadVideoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function UploadVideoModal({ open, onClose, onCreated }: UploadVideoModalProps) {
  const createVideo = useCreateTrainingVideo();
  const saveQuiz = useSaveTrainingVideoQuiz();

  async function handleSaveVideo(values: SupplierVideoFormValues): Promise<SavedVideo> {
    const result = await createVideo.mutateAsync({
      title: values.title.trim(),
      category: values.category,
      certificateId: values.certificateId!,
      description: values.description.trim() || null,
    });
    return { id: result.trainingVideo.id };
  }

  async function handleSaveQuiz(trainingVideoId: string, questions: QuizQuestion[]): Promise<void> {
    await saveQuiz.mutateAsync({
      trainingVideoId,
      questions: questions.map((q) => ({
        question: q.question,
        options: q.answers.map((a) => a.text),
        correctIndex: q.answers.findIndex((a) => a.is_correct),
      })),
    });
  }

  return (
    <TrainingVideoModal
      open={open}
      onClose={onClose}
      initialVideo={null}
      initialFormValues={EMPTY_FORM}
      saveVideo={handleSaveVideo}
      saveQuiz={handleSaveQuiz}
      onQuizSaved={onCreated}
      renderVideoForm={(props) => <SupplierVideoFields {...props} />}
      modalClassName="max-w-[560px]"
      accentClassName="accent-supplier-purple-start"
      saveButtonClassName="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end"
    />
  );
}
