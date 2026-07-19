"use client";

// TODO: still on mock data (lib/mockTutorials.ts) — waiting on this stack's port of
// the old TrainingVideoController (supplier upload endpoint).
import { useRef, useState, type FormEvent } from "react";
import { Video, Image as ImageIcon } from "lucide-react";
import TrainingVideoModal, { type VideoFormRenderProps } from "./TrainingVideoModal";
import Button from "./Button";
import Input from "./Input";
import { VIDEO_CATEGORIES, type VideoCategory, type QuizQuestion, type TutorialVideo } from "@/lib/mockTutorials";

interface SupplierVideoFormValues {
  title: string;
  category: VideoCategory;
  description: string;
}

const EMPTY_FORM: SupplierVideoFormValues = {
  title: "",
  category: "Safety",
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

  function handleSubmit(e: FormEvent) {
    if (!values.title.trim()) {
      e.preventDefault();
      setTitleError("Title is required.");
      return;
    }
    setTitleError("");
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
  id: number;
  title: string;
  category: VideoCategory;
  description: string;
}

interface UploadVideoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (video: TutorialVideo) => void;
}

export default function UploadVideoModal({ open, onClose, onCreated }: UploadVideoModalProps) {
  const lastSavedVideo = useRef<SavedVideo | null>(null);

  async function saveVideo(values: SupplierVideoFormValues, videoId: number | null): Promise<SavedVideo> {
    const saved: SavedVideo = {
      id: videoId ?? Date.now(),
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim(),
    };
    lastSavedVideo.current = saved;
    return saved;
  }

  // Mock only — Sprint 3 wires this to POST /supplier/training-videos/:id/quiz-questions.
  async function saveQuiz(): Promise<void> {}

  function handleQuizSaved(videoId: number, questions: QuizQuestion[]) {
    const saved = lastSavedVideo.current;
    if (!saved || saved.id !== videoId) return;
    onCreated?.({
      id: saved.id,
      title: saved.title,
      category: saved.category,
      duration: "",
      completions: 0,
      quiz: questions,
    });
  }

  return (
    <TrainingVideoModal
      open={open}
      onClose={onClose}
      initialVideo={null}
      initialFormValues={EMPTY_FORM}
      saveVideo={saveVideo}
      saveQuiz={saveQuiz}
      onQuizSaved={handleQuizSaved}
      renderVideoForm={(props) => <SupplierVideoFields {...props} />}
      modalClassName="max-w-[560px]"
      accentClassName="accent-supplier-purple-start"
      saveButtonClassName="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end"
    />
  );
}
