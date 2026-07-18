"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  Award,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Lock,
  Mail,
  MapPin,
  PlayCircle,
  Trophy,
  User,
  Users,
} from "lucide-react";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";
import CertificateDetailModal from "@/components/CertificateDetailModal";
import {
  MOCK_CERTIFICATES,
  MOCK_CURRENT_USER,
  MOCK_ENROLLMENT_SESSIONS,
  MOCK_PASSPORT_QUIZ_QUESTIONS,
  MOCK_TRAINING_VIDEOS,
  MOCK_USER_CERTIFICATES,
  MOCK_VIDEO_COMPLETIONS,
  type Certificate,
  type EnrollmentSession,
  type EnrollmentSessionStatus,
  type TrainingVideo,
} from "@/lib/mockPassport";

const SESSION_STATUS: Record<EnrollmentSessionStatus, { label: string; badge: string }> = {
  enrolled: { label: "Enrolled", badge: "bg-success-green/15 text-success-green border-success-green/30" },
  awaiting: { label: "Awaiting SME Sign-off", badge: "bg-amber/15 text-amber border-amber/30" },
  open: { label: "Open", badge: "bg-user-teal-start/15 text-user-teal-end border-user-teal-start/30" },
  full: { label: "Full", badge: "bg-muted-text/15 text-muted-text border-border" },
};

const SIGN_UP_LABEL: Record<EnrollmentSessionStatus, string> = {
  enrolled: "Already Enrolled",
  full: "Session Full",
  awaiting: "Please wait for Signoff",
  open: "Sign Up for this Session",
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function SessionDetailModal({ session, onClose }: { session: EnrollmentSession | null; onClose: () => void }) {
  const status = session ? SESSION_STATUS[session.status] : null;
  const isSignUpDisabled =
    session?.status === "enrolled" || session?.status === "full" || session?.status === "awaiting";

  return (
    <Modal open={!!session} onClose={onClose} className="w-full max-w-[520px]">
      {session && status && (
        <div className="flex flex-col gap-4 pr-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-user-teal-start/15 text-user-teal-end border border-user-teal-start/30 rounded-full px-2.5 py-1 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-user-teal-end" />
                Onsite Training
              </span>
              <h3 className="font-semibold text-body-text text-lg leading-snug mt-2">{session.title}</h3>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${status.badge}`}>
              {status.label}
            </span>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-2 text-sm text-muted-text">
            <span className="flex items-center gap-2">
              <Calendar size={14} />
              {session.date}
            </span>
            <span className="flex items-center gap-2">
              <MapPin size={14} />
              {session.location}
            </span>
            <span className="flex items-center gap-2">
              <Users size={14} />
              {session.spots_remaining} spot{session.spots_remaining === 1 ? "" : "s"} remaining
            </span>
            <span className="flex items-center gap-2">
              <Building2 size={14} />
              Hosted by: {session.host_company}
            </span>
            <span className="flex items-center gap-2">
              <Award size={14} />
              SME: {session.expert_name}
            </span>
          </div>

          <div className="border-t border-border/40 pt-4">
            <p className="text-sm font-medium text-body-text mb-1">What you&apos;ll earn</p>
            <p className="text-user-teal-end text-sm font-medium">{session.endorsement}</p>
            <p className="text-xs text-muted-text italic mt-1">Required for: {session.required_for}</p>
          </div>

          <div className="border-t border-border/40 pt-4">
            <Button
              disabled={isSignUpDisabled}
              className={`w-full ${isSignUpDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {SIGN_UP_LABEL[session.status]}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SessionCard({ session, onSelect }: { session: EnrollmentSession; onSelect: (session: EnrollmentSession) => void }) {
  const status = SESSION_STATUS[session.status];

  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      className="text-left bg-background border border-border/60 rounded p-5 flex flex-col gap-3 hover:border-user-teal-start/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-supplier-purple-start to-supplier-purple-end flex items-center justify-center text-white text-sm font-semibold">
            {session.expert_initials}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-body-text leading-snug truncate">{session.title}</h3>
            <p className="text-xs text-muted-text truncate">Led by {session.expert_name}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${status.badge}`}>
          {status.label}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-muted-text">
        <span className="flex items-center gap-1.5">
          <Calendar size={14} />
          {session.date}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={14} />
          {session.location}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-text border-t border-border/40 pt-3">
        <Award size={14} className="text-user-teal-end shrink-0" />
        Endorsement: <span className="text-body-text">{session.endorsement}</span>
      </div>

      {session.status === "awaiting" && (
        <p className="text-xs text-amber italic">Awaiting SME sign-off before endorsement is issued</p>
      )}
    </button>
  );
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

function VideoCard({
  video,
  completed,
  onSelect,
}: {
  video: TrainingVideo;
  completed: boolean;
  onSelect: (video: TrainingVideo) => void;
}) {
  return (
    <button type="button" onClick={() => onSelect(video)} className="flex flex-col gap-2 text-left">
      <div className="relative h-28 rounded bg-background flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity">
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
    </button>
  );
}

function TutorialModal({
  video,
  completed,
  onClose,
  onStartQuiz,
}: {
  video: TrainingVideo | null;
  completed: boolean;
  onClose: () => void;
  onStartQuiz: (video: TrainingVideo) => void;
}) {
  return (
    <Modal open={!!video} onClose={onClose} className="w-full max-w-[560px]">
      {video && (
        <div className="flex flex-col gap-4 pr-4">
          <div>
            <h3 className="font-semibold text-body-text text-lg leading-snug">{video.title}</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-background border border-border/60 text-muted-text rounded-full px-2.5 py-1 text-xs">
                {video.category}
              </span>
              {completed && (
                <span className="flex items-center gap-1 bg-success-green/15 text-success-green border border-success-green/30 rounded-full px-2.5 py-1 text-xs font-medium">
                  <CheckCircle2 size={12} />
                  Completed
                </span>
              )}
            </div>
          </div>

          <div className="relative aspect-video rounded bg-background flex flex-col items-center justify-center gap-2 overflow-hidden">
            <PlayCircle size={40} className="text-muted-text" />
            <span className="text-xs text-muted-text">Video placeholder</span>
            <span className="absolute bottom-2 right-2 bg-card/90 text-body-text text-[11px] font-medium px-1.5 py-0.5 rounded">
              {formatDuration(video.duration_seconds)}
            </span>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={() => onStartQuiz(video)}>
              I&apos;ve Understood the Contents
            </Button>
            <p className="text-xs text-muted-text text-center">Unlocks once the video ends</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function QuizModal({ video, onClose }: { video: TrainingVideo | null; onClose: () => void }) {
  return (
    <Modal open={!!video} onClose={onClose} className="w-full max-w-[560px]">
      {video && (
        <div className="flex flex-col gap-4 pr-4">
          <div>
            <h3 className="font-semibold text-body-text text-lg leading-snug">Quiz: {video.title}</h3>
            <p className="text-sm text-muted-text mt-1">Answer all questions to complete this tutorial</p>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-5 max-h-[420px] overflow-y-auto">
            {MOCK_PASSPORT_QUIZ_QUESTIONS.map((q, index) => (
              <div key={q.id}>
                <p className="text-sm font-medium text-body-text mb-2">
                  {index + 1}. {q.question}
                </p>
                <div className="flex flex-col gap-2">
                  {q.options.map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-2.5 bg-background border border-border/60 rounded px-3 py-2 text-sm text-muted-text hover:text-body-text cursor-pointer"
                    >
                      <input type="radio" name={`quiz-question-${q.id}`} className="accent-user-teal-start" />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/40 pt-4">
            <Button type="button" className="w-full" onClick={onClose}>
              Submit Quiz
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function DigitalPassportPage() {
  const [selectedCertId, setSelectedCertId] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const [quizVideo, setQuizVideo] = useState<TrainingVideo | null>(null);
  const [selectedSession, setSelectedSession] = useState<EnrollmentSession | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(MOCK_CURRENT_USER);

  const earnedCertIds = useMemo(() => new Set(MOCK_USER_CERTIFICATES.map((uc) => uc.certificate_id)), []);
  const completedVideoIds = useMemo(() => new Set(MOCK_VIDEO_COMPLETIONS.map((vc) => vc.training_video_id)), []);

  function handleProfileChange(field: "name" | "role" | "avatar_url", value: string) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleProfileChange("avatar_url", reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    setEditing(false);
  }

  function handleToggleEdit() {
    setEditing((e) => !e);
  }

  const selectedCertificate = MOCK_CERTIFICATES.find((cert) => cert.id === selectedCertId) ?? null;
  const selectedUserCertificate =
    MOCK_USER_CERTIFICATES.find((uc) => uc.certificate_id === selectedCertId) ?? null;

  const filterCategories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set([
          ...MOCK_TRAINING_VIDEOS.map((v) => v.category),
          ...MOCK_ENROLLMENT_SESSIONS.map((s) => s.category),
        ])
      ),
    ],
    []
  );

  const filteredVideos =
    activeFilter === "All" ? MOCK_TRAINING_VIDEOS : MOCK_TRAINING_VIDEOS.filter((v) => v.category === activeFilter);
  const filteredSessions =
    activeFilter === "All"
      ? MOCK_ENROLLMENT_SESSIONS
      : MOCK_ENROLLMENT_SESSIONS.filter((s) => s.category === activeFilter);

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
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-muted-text" />
                )}
              </div>
              {editing && (
                <label
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-user-teal-start border-2 border-card flex items-center justify-center text-white cursor-pointer hover:bg-user-teal-end transition-colors"
                  aria-label="Upload avatar"
                >
                  <Camera size={14} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                </label>
              )}
            </div>

            {profile.verified && (
              <span className="inline-flex items-center gap-1.5 mt-3 bg-user-teal-start/90 text-white rounded-full px-3 py-1 text-xs font-medium">
                <Check size={12} />
                Verified
              </span>
            )}

            {editing ? (
              <div className="w-full flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-text">Full Name</label>
                  <Input
                    value={profile.name}
                    onChange={(e) => handleProfileChange("name", e.target.value)}
                    className="w-full focus:!border-user-teal-start"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-text">Job Title</label>
                  <Input
                    value={profile.role}
                    onChange={(e) => handleProfileChange("role", e.target.value)}
                    className="w-full focus:!border-user-teal-start"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-body-text mt-3">{profile.name}</h2>
                <p className="text-sm text-muted-text">{profile.role}</p>
              </>
            )}

            <div className="w-full border-t border-border/40 mt-4 pt-4 flex flex-col gap-3 text-left">
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Mail size={16} />
                {profile.email}
              </span>
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Building2 size={16} />
                {profile.company}
              </span>
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Calendar size={16} />
                Member since {profile.member_since}
              </span>
            </div>

            <Button variant="ghost" className="w-full mt-4" onClick={handleToggleEdit}>
              {editing ? "Cancel Editing" : "Edit Profile"}
            </Button>

            {editing && (
              <Button
                onClick={handleSave}
                className="!bg-gradient-to-r !from-user-teal-start !to-user-teal-end w-full mt-3"
              >
                Save
              </Button>
            )}
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
            <p className="text-xs text-white/80 italic mt-2">
              Earn certifications as needed to access specific spaces and equipment
            </p>
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
            {filterCategories.map((category) => (
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
                    onSelect={setSelectedVideo}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-text">No tutorials in this category yet.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-body-text mb-1">Training Sessions</h2>
            <p className="text-sm text-muted-text mb-6">
              Onsite sessions with field experts — earn an endorsement upon completion
            </p>
            {filteredSessions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {filteredSessions.map((session) => (
                  <SessionCard key={session.id} session={session} onSelect={setSelectedSession} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-text">No sessions in this category yet.</p>
            )}
          </Card>
        </div>
      </div>

      <CertificateDetailModal
        certificate={selectedCertificate}
        userCertificate={selectedUserCertificate}
        onClose={() => setSelectedCertId(null)}
      />
      <TutorialModal
        video={selectedVideo}
        completed={!!selectedVideo && completedVideoIds.has(selectedVideo.id)}
        onClose={() => setSelectedVideo(null)}
        onStartQuiz={(video) => {
          setSelectedVideo(null);
          setQuizVideo(video);
        }}
      />
      <QuizModal video={quizVideo} onClose={() => setQuizVideo(null)} />
      <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
    </div>
  );
}
