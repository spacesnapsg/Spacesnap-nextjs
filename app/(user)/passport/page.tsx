"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Check,
  CheckCircle2,
  Lock,
  Mail,
  MapPin,
  PlayCircle,
  Trophy,
  User,
} from "lucide-react";
import Card from "@/components/Card";
import CertificateDetailModal from "@/components/CertificateDetailModal";
import {
  MOCK_CERTIFICATES,
  MOCK_CURRENT_USER,
  MOCK_TRAINING_VIDEOS,
  MOCK_USER_CERTIFICATES,
  MOCK_VIDEO_COMPLETIONS,
  type Certificate,
  type TrainingVideo,
} from "@/lib/mockPassport";

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function CertBadge({
  certificate,
  earned,
  onSelect,
}: {
  certificate: Certificate;
  earned: boolean;
  onSelect: (certificate: Certificate) => void;
}) {
  if (!earned) {
    return (
      <div className="bg-background border border-border/60 rounded p-3 flex flex-col items-center justify-center gap-1.5 text-center opacity-60">
        <span className="h-7 w-7 rounded-full bg-card flex items-center justify-center">
          <Lock size={10} className="text-muted-text" />
        </span>
        <p className="text-xs font-medium text-muted-text leading-snug">{certificate.name}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(certificate)}
      className="relative text-left bg-background border border-border/60 rounded p-3 flex flex-col items-center justify-center gap-1.5 text-center hover:border-user-teal-start/50 transition-colors"
    >
      <span className="absolute top-1.5 right-1.5 h-3 w-3 rounded-full bg-user-teal-start flex items-center justify-center">
        <Check size={7} className="text-white" />
      </span>
      <span className="text-lg">{certificate.icon}</span>
      <p className="text-xs font-semibold text-body-text leading-snug">{certificate.name}</p>
    </button>
  );
}

function VideoCard({ video, completed }: { video: TrainingVideo; completed: boolean }) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <div className="relative h-28 rounded bg-background flex items-center justify-center overflow-hidden">
        <PlayCircle size={28} className="text-muted-text" />
        {completed && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-success-green/15 text-success-green border border-success-green/30 rounded-full px-2 py-0.5 text-[11px] font-medium">
            <CheckCircle2 size={10} />
            Completed
          </span>
        )}
        <span className="absolute bottom-2 right-2 bg-card/90 text-body-text text-[11px] font-medium px-1.5 py-0.5 rounded">
          {formatDuration(video.duration_seconds)}
        </span>
      </div>
      <span className="inline-block w-fit bg-background border border-border/60 text-muted-text rounded-full px-2 py-0.5 text-[11px]">
        {video.category}
      </span>
      <p className="text-sm text-body-text font-medium leading-snug line-clamp-2">{video.title}</p>
    </div>
  );
}

export default function DigitalPassportPage() {
  const [selectedCertId, setSelectedCertId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");

  const earnedCertIds = useMemo(
    () => new Set(MOCK_USER_CERTIFICATES.map((uc) => uc.certificate_id)),
    []
  );
  const completedVideoIds = useMemo(
    () => new Set(MOCK_VIDEO_COMPLETIONS.map((vc) => vc.training_video_id)),
    []
  );

  const selectedCertificate =
    MOCK_CERTIFICATES.find((cert) => cert.id === selectedCertId) ?? null;
  const selectedUserCertificate =
    MOCK_USER_CERTIFICATES.find((uc) => uc.certificate_id === selectedCertId) ?? null;

  const videoCategories = useMemo(
    () => ["All", ...Array.from(new Set(MOCK_TRAINING_VIDEOS.map((v) => v.category)))],
    []
  );

  const filteredVideos =
    activeFilter === "All"
      ? MOCK_TRAINING_VIDEOS
      : MOCK_TRAINING_VIDEOS.filter((video) => video.category === activeFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-user-teal-start to-user-teal-end bg-clip-text text-transparent">
          Digital Passport
        </h1>
        <p className="text-muted-text mt-1">
          Your certifications, training, and credentials in one place
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-8">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col items-center text-center gap-1">
            <div className="h-24 w-24 rounded-full bg-background border border-border flex items-center justify-center">
              <User size={32} className="text-muted-text" />
            </div>

            <h2 className="text-xl font-bold text-body-text mt-3">{MOCK_CURRENT_USER.name}</h2>
            <p className="text-sm text-muted-text">{MOCK_CURRENT_USER.role}</p>

            <div className="w-full border-t border-border/40 mt-4 pt-4 flex flex-col gap-3 text-left">
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <MapPin size={16} />
                {MOCK_CURRENT_USER.location}
              </span>
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Mail size={16} />
                {MOCK_CURRENT_USER.email}
              </span>
            </div>
          </Card>

          <div className="bg-gradient-to-br from-user-teal-start to-user-teal-end rounded-card p-6 text-white flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Trophy size={18} />
              <span className="font-semibold">Certifications</span>
            </div>
            <p className="text-4xl font-extrabold mt-2">
              {earnedCertIds.size}
              <span className="text-lg font-medium text-white/70"> / {MOCK_CERTIFICATES.length}</span>
            </p>
            <p className="text-sm font-medium">Certifications earned</p>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Award size={18} className="text-body-text" />
              <h2 className="text-lg font-semibold text-body-text">Proficiency Badges</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {MOCK_CERTIFICATES.map((certificate) => (
                <CertBadge
                  key={certificate.id}
                  certificate={certificate}
                  earned={earnedCertIds.has(certificate.id)}
                  onSelect={(cert) => setSelectedCertId(cert.id)}
                />
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {videoCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveFilter(category)}
                className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                  activeFilter === category
                    ? "bg-user-teal-start/20 border-user-teal-start text-user-teal-end"
                    : "bg-card border-border text-muted-text hover:text-body-text"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <Card>
            <h2 className="text-lg font-semibold text-body-text mb-4">Training Tutorials</h2>
            {filteredVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    completed={completedVideoIds.has(video.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-text">No tutorials in this category yet.</p>
            )}
          </Card>
        </div>
      </div>

      <CertificateDetailModal
        certificate={selectedCertificate}
        userCertificate={selectedUserCertificate}
        onClose={() => setSelectedCertId(null)}
      />
    </div>
  );
}
