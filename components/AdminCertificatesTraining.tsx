"use client";

import { useState, type FormEvent } from "react";
import { Plus, Search, Pencil, Trash2, PlayCircle } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import TrainingVideoModal, { type VideoFormRenderProps } from "@/components/TrainingVideoModal";
import { VIDEO_CATEGORIES, type VideoCategory, type QuizQuestion } from "@/lib/mockTutorials";
import {
  useAdminCertificates,
  useApproveCertificate,
  useRejectCertificate,
  useAdminCreateCertificate,
  type AdminCertificate,
  type CertificateStatus,
} from "@/lib/hooks/useAdminCertificates";
import {
  useAdminTrainingVideos,
  useAdminCreateTrainingVideo,
  useAdminUpdateTrainingVideo,
  useAdminDeleteTrainingVideo,
  useAdminSaveTrainingVideoQuiz,
  type AdminTrainingVideo,
} from "@/lib/hooks/useAdminTrainingVideos";
import { ApiRequestError } from "@/lib/api-client";

type MainTab = "certificates" | "training";

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "certificates", label: "Certificates" },
  { id: "training", label: "Training Videos" },
];

const CERT_STATUS_FILTERS: { id: "all" | CertificateStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const CERT_STATUS_LABELS: Record<CertificateStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const CERT_STATUS_BADGE_STYLES: Record<CertificateStatus, string> = {
  pending: "bg-amber/15 text-amber border-amber/30",
  approved: "bg-success-green/15 text-success-green border-success-green/30",
  rejected: "bg-error-red/15 text-error-red border-error-red/30",
};

const VIDEO_CATEGORY_FILTERS: ("all" | VideoCategory)[] = ["all", ...VIDEO_CATEGORIES];

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CertStatusBadge({ status }: { status: CertificateStatus }) {
  return (
    <span className={`inline-block shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${CERT_STATUS_BADGE_STYLES[status]}`}>
      {CERT_STATUS_LABELS[status]}
    </span>
  );
}

function CertificateRow({
  cert,
  expanded,
  onToggleExpand,
  onApprove,
  onReject,
  isMutating,
}: {
  cert: AdminCertificate;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isMutating: boolean;
}) {
  const submittedBy =
    cert.source === "supplier_created" ? cert.createdByCompanyName ?? "Submitted by supplier" : "Added by Admin";

  return (
    <div className="py-4 border-b border-border/60 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body-text font-bold">{cert.name}</p>
            <CertStatusBadge status={cert.status} />
          </div>
          <p className="text-xs text-muted-text mt-1">{submittedBy}</p>

          {cert.submissionNotes && (
            <button type="button" onClick={() => onToggleExpand(cert.id)} className="text-left mt-2">
              <p className={`text-sm text-muted-text ${expanded ? "" : "line-clamp-1"}`}>{cert.submissionNotes}</p>
              <span className="text-xs text-admin-orange-end mt-0.5 inline-block">{expanded ? "Show less" : "Show more"}</span>
            </button>
          )}

          <p className="text-xs text-muted-text mt-2">Submitted {formatDate(cert.createdAt)}</p>
        </div>

        {cert.status === "pending" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onApprove(cert.id)}
              className={`h-9 px-4 rounded text-sm font-medium border border-success-green text-success-green hover:bg-success-green/10 transition-colors ${isMutating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onReject(cert.id)}
              className={`h-9 px-4 rounded text-sm font-medium border border-error-red text-error-red hover:bg-error-red/10 transition-colors ${isMutating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCertificateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const createCertificate = useAdminCreateCertificate();

  function handleClose() {
    setName("");
    setCategory("");
    setSubmissionNotes("");
    createCertificate.reset();
    onClose();
  }

  const errorMessage =
    createCertificate.error instanceof ApiRequestError
      ? createCertificate.error.message
      : createCertificate.error
        ? "Something went wrong."
        : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createCertificate.mutate(
      { name: name.trim(), category: category.trim() || null, submissionNotes: submissionNotes.trim() || null },
      { onSuccess: handleClose }
    );
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-6">Add Certificate</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="w-full focus:!border-admin-red-start" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Category (optional)</label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full focus:!border-admin-red-start" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Description / Context</label>
          <textarea
            value={submissionNotes}
            onChange={(e) => setSubmissionNotes(e.target.value)}
            rows={3}
            className="w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-admin-red-start transition-colors resize-none"
          />
        </div>

        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

        <Button
          type="submit"
          disabled={createCertificate.isPending}
          className={`!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end mt-2 ${createCertificate.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {createCertificate.isPending ? "Adding…" : "Add Certificate"}
        </Button>
      </form>
    </Modal>
  );
}

function CertificatesTab() {
  const [statusFilter, setStatusFilter] = useState<"all" | CertificateStatus>("all");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError } = useAdminCertificates({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search.trim() || undefined,
  });
  const approveCertificate = useApproveCertificate();
  const rejectCertificate = useRejectCertificate();

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApprove(id: string) {
    setActionError(null);
    approveCertificate.mutate(id, {
      onError: (error) => setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong."),
    });
  }

  function handleReject(id: string) {
    setActionError(null);
    rejectCertificate.mutate(id, {
      onError: (error) => setActionError(error instanceof ApiRequestError ? error.message : "Something went wrong."),
    });
  }

  const certificates = data?.certificates ?? [];

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-body-text">All Certificates</h2>
          <Button onClick={() => setAddModalOpen(true)} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end gap-2">
            <Plus size={16} />
            Add Certificate
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search certificates..."
              className="w-full sm:w-64 bg-background border border-border/40 rounded py-3 pr-4 pl-10 text-sm text-body-text placeholder:text-muted-text focus:outline-none focus:border-admin-red-start transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CERT_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === filter.id ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white" : "text-muted-text hover:text-body-text"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {actionError && <p className="text-sm text-error-red mt-4">{actionError}</p>}

      <Card className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-text text-center py-12">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-error-red text-center py-12">Failed to load certificates.</p>
        ) : certificates.length === 0 ? (
          <p className="text-sm text-muted-text text-center py-12">No certificates found</p>
        ) : (
          <div>
            {certificates.map((cert) => (
              <CertificateRow
                key={cert.id}
                cert={cert}
                expanded={expandedIds.has(cert.id)}
                onToggleExpand={toggleExpand}
                onApprove={handleApprove}
                onReject={handleReject}
                isMutating={
                  (approveCertificate.isPending && approveCertificate.variables === cert.id) ||
                  (rejectCertificate.isPending && rejectCertificate.variables === cert.id)
                }
              />
            ))}
          </div>
        )}
      </Card>

      <AddCertificateModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </>
  );
}

interface AdminVideoFormValues {
  title: string;
  category: VideoCategory;
  duration: string;
  thumbnailUrl: string;
  videoUrl: string;
  description: string;
}

const EMPTY_ADMIN_VIDEO_FORM: AdminVideoFormValues = {
  title: "",
  category: VIDEO_CATEGORIES[0],
  duration: "",
  thumbnailUrl: "",
  videoUrl: "",
  description: "",
};

function AdminVideoFields({ values, updateField, onSubmit, saving, error, isEdit }: VideoFormRenderProps<AdminVideoFormValues>) {
  return (
    <>
      <h2 className="text-xl font-semibold text-body-text mb-6">{isEdit ? "Edit Training Video" : "Add Training Video"}</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Title</label>
          <Input value={values.title} onChange={(e) => updateField("title", e.target.value)} required className="w-full focus:!border-admin-red-start" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Category</label>
          <select
            value={values.category}
            onChange={(e) => updateField("category", e.target.value as VideoCategory)}
            className="w-full bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-admin-red-start transition-colors"
          >
            {VIDEO_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Duration</label>
          <Input
            value={values.duration}
            onChange={(e) => updateField("duration", e.target.value)}
            placeholder="e.g. 12:45"
            className="w-full focus:!border-admin-red-start"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Thumbnail URL</label>
          <Input value={values.thumbnailUrl} onChange={(e) => updateField("thumbnailUrl", e.target.value)} className="w-full focus:!border-admin-red-start" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Video URL</label>
          <Input value={values.videoUrl} onChange={(e) => updateField("videoUrl", e.target.value)} className="w-full focus:!border-admin-red-start" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-text mb-1.5 block">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={3}
            className="w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-admin-red-start transition-colors resize-none"
          />
        </div>

        {error && <p className="text-sm text-error-red bg-error-red/10 border border-error-red/30 rounded px-4 py-3">{error}</p>}

        <Button type="submit" disabled={saving} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end mt-2">
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Next"}
        </Button>
      </form>
    </>
  );
}

// MM:SS <-> seconds — the form stays a friendly "12:45" text field, the API
// stores durationSeconds. Invalid/empty input maps to null rather than 0, so
// a blank field doesn't silently save a zero-length duration.
function parseDurationToSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d+):([0-5]?\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatSecondsToDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function VideoModal({
  open,
  onClose,
  initialVideo,
}: {
  open: boolean;
  onClose: () => void;
  initialVideo: AdminTrainingVideo | null;
}) {
  const createVideo = useAdminCreateTrainingVideo();
  const updateVideo = useAdminUpdateTrainingVideo();
  const saveQuizMutation = useAdminSaveTrainingVideoQuiz();

  const initialFormValues: AdminVideoFormValues = initialVideo
    ? {
        title: initialVideo.title,
        category: (initialVideo.category as VideoCategory) ?? VIDEO_CATEGORIES[0],
        duration: formatSecondsToDuration(initialVideo.durationSeconds),
        thumbnailUrl: initialVideo.thumbnailUrl ?? "",
        videoUrl: initialVideo.videoUrl ?? "",
        description: initialVideo.description ?? "",
      }
    : EMPTY_ADMIN_VIDEO_FORM;

  async function saveVideo(values: AdminVideoFormValues, videoId: string | null): Promise<AdminTrainingVideo> {
    const input = {
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim() || null,
      durationSeconds: parseDurationToSeconds(values.duration),
      thumbnailUrl: values.thumbnailUrl.trim() || null,
      videoUrl: values.videoUrl.trim() || null,
    };
    const result = videoId
      ? await updateVideo.mutateAsync({ id: videoId, ...input })
      : await createVideo.mutateAsync(input);
    return result.trainingVideo;
  }

  async function saveQuiz(trainingVideoId: string, questions: QuizQuestion[]): Promise<void> {
    await saveQuizMutation.mutateAsync({
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
      initialVideo={initialVideo}
      initialFormValues={initialFormValues}
      saveVideo={saveVideo}
      saveQuiz={saveQuiz}
      renderVideoForm={(props) => <AdminVideoFields {...props} />}
      modalClassName="w-full max-w-[560px]"
      accentClassName="accent-admin-red-start"
      saveButtonClassName="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end"
    />
  );
}

function DeleteVideoModal({ video, onCancel, onConfirm }: { video: AdminTrainingVideo | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open={!!video} onClose={onCancel} className="w-full max-w-[400px]">
      <h2 className="text-lg font-semibold text-body-text mb-2">Delete this video?</h2>
      <p className="text-sm text-muted-text mb-6">{video ? `"${video.title}" will be permanently removed.` : ""}</p>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onCancel} className="h-9 px-4 text-sm">
          Cancel
        </Button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-9 px-4 rounded text-sm font-medium border border-error-red text-error-red hover:bg-error-red/10 transition-colors"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}

function VideoCard({ video, onEdit, onDelete }: { video: AdminTrainingVideo; onEdit: (video: AdminTrainingVideo) => void; onDelete: (video: AdminTrainingVideo) => void }) {
  const duration = formatSecondsToDuration(video.durationSeconds);
  return (
    <div className="bg-card border border-border/10 rounded-card overflow-hidden group">
      <div className="relative h-40 bg-background flex items-center justify-center">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <PlayCircle size={28} className="text-muted-text" />
        )}
        {video.category && (
          <span className="absolute bottom-3 left-3 bg-background/90 border border-border/60 text-muted-text rounded-full px-2.5 py-1 text-[11px] font-medium">
            {video.category}
          </span>
        )}
        {duration && (
          <span className="absolute bottom-3 right-3 bg-background/90 text-body-text text-[11px] font-medium px-1.5 py-0.5 rounded">{duration}</span>
        )}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(video)}
            aria-label="Edit video"
            className="w-8 h-8 rounded-full bg-background/90 flex items-center justify-center text-body-text hover:text-admin-orange-end transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(video)}
            aria-label="Delete video"
            className="w-8 h-8 rounded-full bg-background/90 flex items-center justify-center text-body-text hover:text-error-red transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-sm text-body-text px-4 py-4">{video.title}</p>
    </div>
  );
}

function TrainingVideosTab() {
  const [modalState, setModalState] = useState<{ open: boolean; video: AdminTrainingVideo | null }>({ open: false, video: null });
  const [deleteTarget, setDeleteTarget] = useState<AdminTrainingVideo | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | VideoCategory>("all");

  const { data, isLoading, isError } = useAdminTrainingVideos({
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });
  const deleteVideo = useAdminDeleteTrainingVideo();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteVideo.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  const videos = data ?? [];

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold text-body-text">Training Videos</h2>
        <Button onClick={() => setModalState({ open: true, video: null })} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end gap-2">
          <Plus size={16} />
          Add Video
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {VIDEO_CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setCategoryFilter(filter)}
            className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              categoryFilter === filter ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white" : "text-muted-text hover:text-body-text"
            }`}
          >
            {filter === "all" ? "All" : filter}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-text text-center py-12">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-error-red text-center py-12">Failed to load training videos.</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-12">No videos found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} onEdit={(v) => setModalState({ open: true, video: v })} onDelete={(v) => setDeleteTarget(v)} />
          ))}
        </div>
      )}

      <VideoModal open={modalState.open} initialVideo={modalState.video} onClose={() => setModalState({ open: false, video: null })} />

      <DeleteVideoModal video={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} />
    </Card>
  );
}

export default function AdminCertificatesTraining() {
  const [activeTab, setActiveTab] = useState<MainTab>("certificates");

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Certificates & Training
        </h1>
        <p className="text-muted-text mt-1">Manage certificate pool and training content</p>
      </div>

      <div className="inline-flex bg-card border border-border rounded-full p-1 gap-1 w-fit mb-6">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-gradient-to-r from-admin-red-start to-admin-orange-end text-white" : "text-muted-text hover:text-body-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "certificates" ? <CertificatesTab /> : <TrainingVideosTab />}
    </div>
  );
}
