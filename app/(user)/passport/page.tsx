"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Award, Building2, Calendar, Camera, Check, CheckCircle2, Lock, Mail, MapPin, PlayCircle, Trophy, User, Users } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import CertificateDetailModal from "@/components/CertificateDetailModal";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useCertificateCatalog, type Certificate } from "@/lib/hooks/useCertificates";
import { useCredentials, isCredentialHeld } from "@/lib/hooks/useCredentials";
import { useTrainingSessions, useEnrollInTrainingSession, type TrainingSession } from "@/lib/hooks/useTrainingSessions";
import {
  useTrainingVideos,
  useTrainingVideoDetail,
  useCompleteTrainingVideo,
  useSubmitQuizAttempt,
  type TrainingVideo,
} from "@/lib/hooks/useTrainingVideos";
import { ApiRequestError } from "@/lib/api-client";

const SESSION_BADGE: Record<string, { label: string; className: string }> = {
  enrolled: { label: "Enrolled", className: "bg-success-green/15 text-success-green border-success-green/30" },
  waitlisted: { label: "Waitlisted", className: "bg-amber/15 text-amber border-amber/30" },
  awaiting_signoff: { label: "Awaiting Sign-off", className: "bg-amber/15 text-amber border-amber/30" },
  completed: { label: "Completed", className: "bg-success-green/15 text-success-green border-success-green/30" },
  cancelled: { label: "Cancelled", className: "bg-error-red/15 text-error-red border-error-red/30" },
  full: { label: "Full", className: "bg-white/10 text-body-text border-white/20" },
  past: { label: "Past", className: "bg-white/10 text-muted-text border-white/20" },
  open: { label: "Open", className: "bg-user-teal-start/15 text-user-teal-end border-user-teal-start/30" },
};

function sessionBadge(session: TrainingSession) {
  return SESSION_BADGE[session.myEnrollmentStatus ?? session.derivedStatus];
}

function sessionActionLabel(session: TrainingSession): { label: string; disabled: boolean } {
  if (session.derivedStatus === "past") return { label: "Session Has Passed", disabled: true };
  switch (session.myEnrollmentStatus) {
    case "enrolled":
      return { label: "Already Enrolled", disabled: true };
    case "waitlisted":
      return { label: "On Waitlist", disabled: true };
    case "awaiting_signoff":
      return { label: "Awaiting Sign-off", disabled: true };
    case "completed":
      return { label: "Completed", disabled: true };
    case "cancelled":
      return { label: "Enrollment Cancelled", disabled: true };
    default:
      return session.derivedStatus === "full"
        ? { label: "Join Waitlist", disabled: false }
        : { label: "Sign Up for this Session", disabled: false };
  }
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

function SessionCard({ session, onSelect }: { session: TrainingSession; onSelect: (session: TrainingSession) => void }) {
  const badge = sessionBadge(session);
  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      className="text-left bg-background border border-border/60 rounded p-5 flex flex-col gap-3 hover:border-user-teal-start/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-body-text leading-snug truncate">{session.title}</h3>
          <p className="text-xs text-muted-text truncate">Led by {session.smeName}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-muted-text">
        <span className="flex items-center gap-1.5">
          <Calendar size={14} />
          {formatSessionDate(session.sessionDatetime)}
        </span>
        {session.location && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} />
            {session.location}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Users size={14} />
          {session.enrolledCount} / {session.capacity} enrolled
          {session.waitlistCount > 0 ? ` · ${session.waitlistCount} waitlisted` : ""}
        </span>
      </div>

      {session.endorsementName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-text border-t border-border/40 pt-3">
          <Award size={14} className="text-user-teal-start shrink-0" />
          Endorsement: <span className="text-body-text">{session.endorsementName}</span>
        </div>
      )}
    </button>
  );
}

function SessionDetailModal({ session, onClose }: { session: TrainingSession | null; onClose: () => void }) {
  const enrollMutation = useEnrollInTrainingSession();

  function handleClose() {
    enrollMutation.reset();
    onClose();
  }

  const action = session ? sessionActionLabel(session) : null;
  const badge = session ? sessionBadge(session) : null;

  return (
    <Modal open={!!session} onClose={handleClose} className="max-w-[520px]">
      {session && action && badge && (
        <div className="flex flex-col gap-4 pr-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-user-teal-start/15 text-user-teal-end border border-user-teal-start/30 rounded-full px-2.5 py-1 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-user-teal-start" />
                Onsite Training
              </span>
              <h3 className="font-semibold text-body-text text-lg leading-snug mt-2">{session.title}</h3>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {session.description && <p className="text-sm text-muted-text">{session.description}</p>}

          <div className="border-t border-border/40 pt-4 flex flex-col gap-2 text-sm text-muted-text">
            <span className="flex items-center gap-2">
              <Calendar size={14} />
              {formatSessionDate(session.sessionDatetime)}
            </span>
            {session.location && (
              <span className="flex items-center gap-2">
                <MapPin size={14} />
                {session.location}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Users size={14} />
              {session.enrolledCount} / {session.capacity} enrolled
              {session.waitlistCount > 0 ? ` · ${session.waitlistCount} on waitlist` : ""}
            </span>
            {session.hostCompanyName && (
              <span className="flex items-center gap-2">
                <Building2 size={14} />
                Hosted by: {session.hostCompanyName}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Award size={14} />
              SME: {session.smeName}
            </span>
          </div>

          {session.endorsementName && (
            <div className="border-t border-border/40 pt-4">
              <p className="text-sm font-medium text-body-text mb-1">What you&apos;ll earn</p>
              <p className="text-user-teal-end text-sm font-medium">{session.endorsementName}</p>
              {session.certificateName && (
                <p className="text-xs text-muted-text italic mt-1">Certificate: {session.certificateName}</p>
              )}
            </div>
          )}

          <div className="border-t border-border/40 pt-4">
            <Button
              disabled={action.disabled || enrollMutation.isPending}
              className={`w-full ${action.disabled ? "!bg-none !bg-white/10 !text-muted-text cursor-not-allowed" : "!bg-gradient-to-r !from-user-teal-start !to-user-teal-end"}`}
              onClick={() => enrollMutation.mutate(session.id)}
            >
              {enrollMutation.isPending ? "Submitting…" : action.label}
            </Button>
            {enrollMutation.isError && (
              <p className="text-xs text-error-red mt-2">
                {enrollMutation.error instanceof ApiRequestError
                  ? enrollMutation.error.message
                  : "Something went wrong — please try again."}
              </p>
            )}
            {enrollMutation.isSuccess && (
              <p className="text-xs text-success-green mt-2">
                {enrollMutation.data.trainingEnrollment.status === "waitlisted"
                  ? "You're on the waitlist — the supplier will approve you if a spot opens up."
                  : "You're enrolled!"}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function formatVideoDuration(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function TutorialCard({ video, onSelect }: { video: TrainingVideo; onSelect: (video: TrainingVideo) => void }) {
  const duration = formatVideoDuration(video.durationSeconds);
  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className="text-left bg-background border border-border/60 rounded p-4 flex flex-col gap-3 hover:border-user-teal-start/50 transition-colors"
    >
      <div className="relative h-28 rounded bg-card flex items-center justify-center">
        <PlayCircle size={24} className="text-muted-text" />
        {duration && (
          <span className="absolute bottom-2 right-2 bg-background/90 text-body-text text-[11px] font-medium px-1.5 py-0.5 rounded">
            {duration}
          </span>
        )}
        {video.completedByMe && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-success-green/15 text-success-green border border-success-green/30 rounded-full px-2 py-0.5 text-[11px] font-medium">
            <CheckCircle2 size={10} />
            Completed
          </span>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-body-text leading-snug line-clamp-2">{video.title}</h3>
        <p className="text-xs text-muted-text mt-0.5">
          {video.category ?? "General"}
          {video.hasQuiz ? " · Quiz required" : ""}
        </p>
      </div>
    </button>
  );
}

// Two-step flow: "watch" (video placeholder + either a plain "mark as
// watched" completion for informational videos, or a launch into "quiz" for
// videos backing a tier1_video_quiz certificate — see the TrainingVideo
// model comment in schema.prisma for why most videos have no quiz at all).
// Mirrors the old spacesnap-web mockup's TutorialModal/QuizModal split
// (DigitalPassport.jsx), now against real data.
function TutorialDetailModal({ videoId, onClose }: { videoId: string | null; onClose: () => void }) {
  const { data, isLoading } = useTrainingVideoDetail(videoId);
  const [step, setStep] = useState<"watch" | "quiz">("watch");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const completeVideo = useCompleteTrainingVideo();
  const submitAttempt = useSubmitQuizAttempt();

  // Reset step/answers/mutation state whenever a different video (or none)
  // is selected — same during-render reset idiom as TrainingVideoModal.
  const resetKey = videoId ?? "closed";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setStep("watch");
    setAnswers({});
    completeVideo.reset();
    submitAttempt.reset();
  }

  const video = data?.trainingVideo;
  const quizQuestions = data?.quizQuestions ?? [];
  const allAnswered = quizQuestions.length > 0 && quizQuestions.every((q) => answers[q.id]);

  function handleSubmitQuiz() {
    if (!videoId) return;
    submitAttempt.mutate({
      trainingVideoId: videoId,
      answers: quizQuestions.map((q) => ({ questionId: q.id, answerId: answers[q.id] })),
    });
  }

  return (
    <Modal open={!!videoId} onClose={onClose} className="w-full max-w-[560px]">
      {isLoading || !video ? (
        <p className="text-sm text-muted-text text-center py-12">Loading…</p>
      ) : step === "watch" ? (
        <div className="flex flex-col gap-4 pr-4">
          <div>
            <h3 className="font-semibold text-body-text text-lg leading-snug">{video.title}</h3>
            <div className="flex items-center gap-2 mt-2">
              {video.category && (
                <span className="bg-background border border-border/60 text-muted-text rounded-full px-2.5 py-1 text-xs">
                  {video.category}
                </span>
              )}
              {video.completedByMe && (
                <span className="flex items-center gap-1 bg-success-green/15 text-success-green border border-success-green/30 rounded-full px-2.5 py-1 text-xs font-medium">
                  <CheckCircle2 size={12} />
                  Completed
                </span>
              )}
            </div>
          </div>

          {video.description && <p className="text-sm text-muted-text">{video.description}</p>}

          <div className="relative aspect-video rounded bg-background border border-border/40 flex flex-col items-center justify-center gap-2 overflow-hidden">
            <PlayCircle size={40} className="text-muted-text" />
            <span className="text-xs text-muted-text">Video placeholder</span>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
            {video.hasQuiz ? (
              <Button
                type="button"
                className="w-full !bg-gradient-to-r !from-user-teal-start !to-user-teal-end"
                onClick={() => setStep("quiz")}
              >
                {video.myLatestQuizAttempt ? "Retake Quiz" : "Take the Quiz"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={video.completedByMe || completeVideo.isPending}
                className={`w-full ${
                  video.completedByMe
                    ? "!bg-none !bg-white/10 !text-muted-text cursor-not-allowed"
                    : "!bg-gradient-to-r !from-user-teal-start !to-user-teal-end"
                }`}
                onClick={() => videoId && completeVideo.mutate(videoId)}
              >
                {video.completedByMe ? "Already Watched" : completeVideo.isPending ? "Saving…" : "I've Understood the Contents"}
              </Button>
            )}
            {video.myLatestQuizAttempt && (
              <p className="text-xs text-center text-muted-text">
                Last attempt: {video.myLatestQuizAttempt.score}/{video.myLatestQuizAttempt.totalQuestions}
                {video.myLatestQuizAttempt.passed ? " — passed" : " — not yet passed"}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pr-4">
          <div>
            <h3 className="font-semibold text-body-text text-lg leading-snug">Quiz: {video.title}</h3>
            <p className="text-sm text-muted-text mt-1">Answer all questions to complete this tutorial</p>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-5 max-h-[420px] overflow-y-auto">
            {quizQuestions.map((q, index) => (
              <div key={q.id}>
                <p className="text-sm font-medium text-body-text mb-2">
                  {index + 1}. {q.question}
                </p>
                <div className="flex flex-col gap-2">
                  {q.answers.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2.5 bg-background border border-border/60 rounded px-3 py-2 text-sm text-muted-text hover:text-body-text cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`quiz-question-${q.id}`}
                        checked={answers[q.id] === a.id}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: a.id }))}
                        className="accent-user-teal-start"
                      />
                      {a.text}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {submitAttempt.isError && (
            <p className="text-xs text-error-red">
              {submitAttempt.error instanceof ApiRequestError ? submitAttempt.error.message : "Something went wrong — please try again."}
            </p>
          )}

          {submitAttempt.isSuccess ? (
            <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
              <p className={`text-sm font-medium ${submitAttempt.data.quizAttempt.passed ? "text-success-green" : "text-error-red"}`}>
                {submitAttempt.data.quizAttempt.passed
                  ? `Passed! Scored ${submitAttempt.data.quizAttempt.score}/${submitAttempt.data.quizAttempt.totalQuestions}.`
                  : `Not quite — scored ${submitAttempt.data.quizAttempt.score}/${submitAttempt.data.quizAttempt.totalQuestions}. Every question must be correct to pass.`}
              </p>
              {submitAttempt.data.credentialIssued && (
                <p className="text-xs text-success-green">Certificate earned — check your Proficiency Badges above.</p>
              )}
              <Button type="button" className="w-full !bg-gradient-to-r !from-user-teal-start !to-user-teal-end" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <div className="border-t border-border/40 pt-4">
              <Button
                type="button"
                disabled={!allAnswered || submitAttempt.isPending}
                className="w-full !bg-gradient-to-r !from-user-teal-start !to-user-teal-end"
                onClick={handleSubmitQuiz}
              >
                {submitAttempt.isPending ? "Submitting…" : "Submit Quiz"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function CertBadge({
  certificate,
  earned,
  highlighted,
  onSelect,
}: {
  certificate: Certificate;
  earned: boolean;
  highlighted: boolean;
  onSelect: (certificate: Certificate) => void;
}) {
  const highlightClass = highlighted ? "ring-2 ring-user-teal-start" : "";

  if (!earned) {
    return (
      <button
        type="button"
        id={`cert-badge-${certificate.id}`}
        onClick={() => onSelect(certificate)}
        className={`bg-background border border-border/60 rounded p-3 flex flex-col items-center justify-center gap-1.5 text-center opacity-60 hover:opacity-80 transition-opacity ${highlightClass}`}
      >
        <span className="h-7 w-7 rounded-full bg-card flex items-center justify-center">
          <Lock size={10} className="text-muted-text" />
        </span>
        <p className="text-xs font-medium text-muted-text leading-snug">{certificate.name}</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      id={`cert-badge-${certificate.id}`}
      onClick={() => onSelect(certificate)}
      className={`relative text-left bg-background border border-border/60 rounded p-3 flex flex-col items-center justify-center gap-1.5 text-center hover:border-user-teal-start/50 transition-colors ${highlightClass}`}
    >
      <span className="absolute top-1.5 right-1.5 h-3 w-3 rounded-full bg-user-teal-start flex items-center justify-center">
        <Check size={7} className="text-white" />
      </span>
      <span className="text-lg">{certificate.icon}</span>
      <p className="text-xs font-semibold text-body-text leading-snug">{certificate.name}</p>
    </button>
  );
}

export default function DigitalPassportPage() {
  const searchParams = useSearchParams();
  const filterCertId = searchParams.get("certId");

  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: catalog, isLoading: catalogLoading } = useCertificateCatalog();
  const { data: credentials } = useCredentials();
  const { data: trainingSessions } = useTrainingSessions();
  const { data: trainingVideos } = useTrainingVideos();
  const selectedSession = trainingSessions?.find((s) => s.id === selectedSessionId) ?? null;

  const hasHandledFilterRef = useRef(false);
  useEffect(() => {
    if (hasHandledFilterRef.current) return;
    if (!filterCertId || !catalog) return;
    if (!catalog.some((cert) => cert.id === filterCertId)) return;

    hasHandledFilterRef.current = true;
    setSelectedCertId(filterCertId);
    document.getElementById(`cert-badge-${filterCertId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [filterCertId, catalog]);

  const [profileEdits, setProfileEdits] = useState<{ name: string; title: string; companyName: string; avatarUrl: string | null } | null>(
    null
  );

  const profile = profileEdits ?? {
    name: user?.name ?? "",
    title: user?.title ?? "",
    companyName: user?.companyName ?? "",
    avatarUrl: user?.avatarUrl ?? null,
  };

  function handleProfileChange(field: "name" | "title" | "companyName" | "avatarUrl", value: string) {
    setProfileEdits({ ...profile, [field]: value });
  }

  function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleProfileChange("avatarUrl", reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleToggleEdit() {
    if (!editing) setProfileEdits(null);
    setEditing((e) => !e);
  }

  const earnedCertIds = useMemo(() => {
    const ids = new Set<string>();
    for (const cert of catalog ?? []) {
      if (isCredentialHeld(credentials, cert.id)) ids.add(cert.id);
    }
    return ids;
  }, [catalog, credentials]);
  const selectedCertificate = catalog?.find((cert) => cert.id === selectedCertId) ?? null;
  const selectedCredential = credentials?.find((c) => c.certificateId === selectedCertId) ?? null;

  if (userLoading || catalogLoading) {
    return <p className="text-sm text-muted-text text-center py-16">Loading passport…</p>;
  }

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
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
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
                    value={profile.title}
                    onChange={(e) => handleProfileChange("title", e.target.value)}
                    className="w-full focus:!border-user-teal-start"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-text">Company</label>
                  <Input
                    value={profile.companyName}
                    onChange={(e) => handleProfileChange("companyName", e.target.value)}
                    className="w-full focus:!border-user-teal-start"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-body-text mt-3">{profile.name}</h2>
                <p className="text-sm text-muted-text">{profile.title}</p>
              </>
            )}

            <div className="w-full border-t border-border/40 mt-4 pt-4 flex flex-col gap-3 text-left">
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Mail size={16} />
                {user?.email}
              </span>
              {profile.companyName && (
                <span className="flex items-center gap-2.5 text-sm text-muted-text">
                  <Building2 size={16} />
                  {profile.companyName}
                </span>
              )}
              <span className="flex items-center gap-2.5 text-sm text-muted-text">
                <Calendar size={16} />
                Member since{" "}
                {user
                  ? new Date(user.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : ""}
              </span>
            </div>

            <Button variant="ghost" className="w-full mt-4" onClick={handleToggleEdit}>
              {editing ? "Cancel Editing" : "Edit Profile"}
            </Button>

            {editing && (
              <Button
                onClick={handleToggleEdit}
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
              <span className="text-lg font-medium text-white/70"> / {catalog?.length ?? 0}</span>
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
              {(catalog ?? []).map((certificate) => (
                <CertBadge
                  key={certificate.id}
                  certificate={certificate}
                  earned={earnedCertIds.has(certificate.id)}
                  highlighted={filterCertId === certificate.id}
                  onSelect={(cert) => setSelectedCertId(cert.id)}
                />
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-body-text mb-1">Training Tutorials</h2>
            <p className="text-sm text-muted-text mb-6">Watch a video or pass its quiz to earn the credential it backs</p>
            {trainingVideos && trainingVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trainingVideos.map((video) => (
                  <TutorialCard key={video.id} video={video} onSelect={(v) => setSelectedVideoId(v.id)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-text">No training videos available yet.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-body-text mb-1">Training Sessions</h2>
            <p className="text-sm text-muted-text mb-6">
              Onsite sessions with field experts — earn an endorsement upon completion
            </p>
            {trainingSessions && trainingSessions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {trainingSessions.map((session) => (
                  <SessionCard key={session.id} session={session} onSelect={(s) => setSelectedSessionId(s.id)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-text">No training sessions scheduled yet.</p>
            )}
          </Card>
        </div>
      </div>

      <CertificateDetailModal
        certificate={selectedCertificate}
        credential={selectedCredential ?? null}
        onClose={() => setSelectedCertId(null)}
      />
      <SessionDetailModal session={selectedSession} onClose={() => setSelectedSessionId(null)} />
      <TutorialDetailModal videoId={selectedVideoId} onClose={() => setSelectedVideoId(null)} />
    </div>
  );
}
