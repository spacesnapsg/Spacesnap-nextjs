"use client";

import { useState } from "react";
import { Plus, PlayCircle, Users, Calendar, MapPin, X } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import UploadVideoModal from "@/components/UploadVideoModal";
import CreateSessionModal from "@/components/CreateSessionModal";
import ViewNamelistModal from "@/components/ViewNamelistModal";
import { VIDEO_CATEGORIES, type VideoCategory } from "@/lib/mockTutorials";
import { useSupplierTrainingSessions, type SupplierTrainingSession } from "@/lib/hooks/useSupplierTrainingSessions";
import { useTrainingVideos, type TrainingVideo } from "@/lib/hooks/useTrainingVideos";

type Tab = "videos" | "sessions";

const TABS: { id: Tab; label: string }[] = [
  { id: "videos", label: "Video Tutorials" },
  { id: "sessions", label: "Training Sessions" },
];

type VideoFilter = "All" | VideoCategory;

const VIDEO_FILTERS: VideoFilter[] = ["All", ...VIDEO_CATEGORIES];

const CATEGORY_STYLES: Record<VideoCategory, string> = {
  Safety: "bg-amber/15 text-amber border-amber/30",
  Equipment: "bg-supplier-purple-start/15 text-supplier-purple-end border-supplier-purple-start/30",
  "House Rules": "bg-white/10 text-body-text border-white/20",
  Techniques: "bg-success-green/15 text-success-green border-success-green/30",
};

// TrainingSession has no stored status column — "open/full/past" is always
// derived server-side (deriveSessionStatus, lib/training-sessions.ts), never
// a state a supplier sets directly. No "cancelled" here — there's no
// cancel-session feature (the old Laravel backend never had one either).
const DERIVED_STATUS_STYLES: Record<SupplierTrainingSession["derivedStatus"], string> = {
  open: "bg-supplier-purple-start/15 text-supplier-purple-end border-supplier-purple-start/30",
  full: "bg-amber/15 text-amber border-amber/30",
  past: "bg-white/10 text-body-text border-white/20",
};

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function VideoCard({ video }: { video: TrainingVideo }) {
  const duration = formatDuration(video.durationSeconds);
  return (
    <div className="bg-card border border-border/10 rounded-card overflow-hidden flex flex-col">
      <div className="relative h-40 bg-background flex items-center justify-center">
        <PlayCircle size={28} className="text-muted-text" />
        {video.category && (
          <span
            className={`absolute bottom-3 left-3 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              CATEGORY_STYLES[video.category as VideoCategory] ?? "bg-white/10 text-body-text border-white/20"
            }`}
          >
            {video.category}
          </span>
        )}
        {duration && (
          <span className="absolute bottom-3 right-3 bg-background/90 text-body-text text-[11px] font-medium px-1.5 py-0.5 rounded">
            {duration}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1">
        <h3 className="font-semibold text-body-text leading-snug line-clamp-2">{video.title}</h3>
        <p className="text-xs text-muted-text">{video.completionCount} completions</p>
      </div>
    </div>
  );
}

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SessionRow({
  session,
  onViewNamelist,
}: {
  session: SupplierTrainingSession;
  onViewNamelist: (session: SupplierTrainingSession) => void;
}) {
  return (
    <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="min-w-0">
        <h3 className="font-semibold text-body-text leading-snug truncate">{session.title}</h3>
        <p className="text-sm text-muted-text mt-0.5 truncate flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatSessionDate(session.sessionDatetime)}
          </span>
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {session.location}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-body-text font-medium shrink-0 sm:justify-center sm:w-20">
        <Users size={14} className="text-muted-text" />
        {session.enrolledCount} / {session.capacity}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${DERIVED_STATUS_STYLES[session.derivedStatus]}`}
        >
          {session.derivedStatus}
        </span>
        <Button variant="ghost" onClick={() => onViewNamelist(session)} className="h-9 px-4 text-sm">
          View Namelist
        </Button>
      </div>
    </Card>
  );
}

export default function SupplierTutorialsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("videos");
  const [activeFilter, setActiveFilter] = useState<VideoFilter>("All");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [namelistSessionId, setNamelistSessionId] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const { data: sessions } = useSupplierTrainingSessions();
  const namelistSession = sessions?.find((s) => s.id === namelistSessionId) ?? null;

  const { data: videos } = useTrainingVideos(activeFilter === "All" ? undefined : { category: activeFilter });
  const filteredVideos = videos ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
          Training Management
        </h1>
        <p className="text-muted-text mt-1">Manage video tutorials and onsite training sessions</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="inline-flex bg-card border border-border rounded-full p-1 gap-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-supplier-purple-start/20 border border-supplier-purple-start text-supplier-purple-end"
                  : "border border-transparent text-muted-text hover:text-body-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "videos" ? (
          <Button
            onClick={() => setUploadOpen(true)}
            className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end gap-1.5 self-start sm:self-auto"
          >
            <Plus size={18} />
            Upload Video
          </Button>
        ) : (
          <Button
            onClick={() => setSessionModalOpen(true)}
            className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end gap-1.5 self-start sm:self-auto"
          >
            <Plus size={18} />
            New Session
          </Button>
        )}
      </div>

      {activeTab === "videos" ? (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {VIDEO_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                  activeFilter === filter
                    ? "bg-supplier-purple-start/20 border-supplier-purple-start text-supplier-purple-end"
                    : "bg-card border-border text-muted-text hover:text-body-text"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </>
      ) : (
        <>
          {showSuccessBanner && (
            <div className="flex items-center justify-between gap-4 bg-success-green/15 border border-success-green/30 text-success-green rounded px-4 py-3 mb-6">
              <p className="text-sm font-medium">Session created</p>
              <button
                type="button"
                onClick={() => setShowSuccessBanner(false)}
                aria-label="Dismiss"
                className="text-success-green hover:opacity-70 transition-opacity shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {sessions && sessions.length > 0 ? (
            <div className="flex flex-col gap-4">
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} onViewNamelist={(s) => setNamelistSessionId(s.id)} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-text">No training sessions yet — create one to get started.</p>
          )}
        </>
      )}

      <UploadVideoModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <CreateSessionModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        onCreated={() => setShowSuccessBanner(true)}
      />
      <ViewNamelistModal session={namelistSession} onClose={() => setNamelistSessionId(null)} />
    </div>
  );
}
