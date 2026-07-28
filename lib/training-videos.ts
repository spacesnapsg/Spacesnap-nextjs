import {
  CertificateEarningMethod,
  CertificateStatus,
  type Company,
  type Prisma,
  type QuizAttempt,
  type TrainingVideo,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";
import { serializeQuizAttempt } from "@/lib/quiz-attempts";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const trainingVideoListArgs = {
  include: { company: true, _count: { select: { quizQuestions: true, videoCompletions: true } } },
} satisfies Prisma.TrainingVideoDefaultArgs;

export type TrainingVideoWithCounts = Prisma.TrainingVideoGetPayload<typeof trainingVideoListArgs>;

interface ViewerState {
  completedByMe: boolean;
  myLatestQuizAttempt: QuizAttempt | null;
}

// Base fields always present; company/_count/viewer sections are each
// included only when the caller actually loaded/computed them, same
// conditional-spread idiom as serializeCertificate/serializeListing.
export function serializeTrainingVideo(
  video: TrainingVideo | (TrainingVideo & { company?: Company | null }),
  extras?: { counts?: { quizQuestions: number; videoCompletions: number } | null; viewer?: ViewerState | null }
) {
  return {
    id: video.id.toString(),
    companyId: video.companyId ? video.companyId.toString() : null,
    companyName: "company" in video ? (video.company?.name ?? null) : undefined,
    certificateId: video.certificateId ? video.certificateId.toString() : null,
    title: video.title,
    category: video.category,
    description: video.description,
    durationSeconds: video.durationSeconds,
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
    ...(extras?.counts
      ? { hasQuiz: extras.counts.quizQuestions > 0, completionCount: extras.counts.videoCompletions }
      : {}),
    ...(extras?.viewer
      ? {
          completedByMe: extras.viewer.completedByMe,
          myLatestQuizAttempt: extras.viewer.myLatestQuizAttempt
            ? serializeQuizAttempt(extras.viewer.myLatestQuizAttempt)
            : null,
        }
      : {}),
  };
}

// A video with a quiz is "completed" once the viewer has a passing attempt
// (mirrors gradeAndSubmitQuizAttempt's own pass rule); a video with no quiz
// is "completed" purely via VideoCompletion (the plain "watched it" case —
// most videos are informational only, see the TrainingVideo model comment
// in schema.prisma).
export function deriveViewerState(
  hasQuiz: boolean,
  videoCompletions: { userId: string }[],
  latestQuizAttempt: QuizAttempt | null
): ViewerState {
  const completedByMe = hasQuiz ? (latestQuizAttempt?.passed ?? false) : videoCompletions.length > 0;
  return { completedByMe, myLatestQuizAttempt: latestQuizAttempt };
}

interface ParsedTrainingVideoFields {
  title?: string;
  category?: string;
  certificateId?: bigint;
  description?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

// Mirrors TrainingVideoController::rules() — title/category required on
// create, "sometimes" (present-if-given) on update; description/duration/
// thumbnail/video are always optional+nullable. certificateId is required on
// create too (session: certificate-picker-for-training-videos) — every
// training video must land the viewer a certificate on a passing quiz, so
// authoring one without picking a certificate is no longer allowed.
export function parseTrainingVideoFields(body: unknown, options: { partial: boolean }): ParsedTrainingVideoFields {
  const errors: Record<string, string[]> = {};
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: ParsedTrainingVideoFields = {};

  const hasTitle = Object.prototype.hasOwnProperty.call(b, "title");
  if (!options.partial || hasTitle) {
    if (typeof b.title !== "string" || !b.title.trim()) {
      errors.title = ["title is required."];
    } else {
      result.title = b.title.trim();
    }
  }

  const hasCategory = Object.prototype.hasOwnProperty.call(b, "category");
  if (!options.partial || hasCategory) {
    if (typeof b.category !== "string" || !b.category.trim()) {
      errors.category = ["category is required."];
    } else {
      result.category = b.category.trim();
    }
  }

  const hasCertificateId = Object.prototype.hasOwnProperty.call(b, "certificateId");
  if (!options.partial || hasCertificateId) {
    const raw = b.certificateId;
    const str = typeof raw === "number" ? String(raw) : raw;
    if (typeof str !== "string" || !/^\d+$/.test(str)) {
      errors.certificateId = ["certificateId is required."];
    } else {
      result.certificateId = BigInt(str);
    }
  }

  if (Object.prototype.hasOwnProperty.call(b, "description")) {
    if (!isNullableString(b.description)) {
      errors.description = ["description must be a string."];
    } else {
      result.description = b.description?.trim() || null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(b, "durationSeconds")) {
    if (b.durationSeconds !== null && (typeof b.durationSeconds !== "number" || b.durationSeconds < 0)) {
      errors.durationSeconds = ["durationSeconds must be a non-negative number."];
    } else {
      result.durationSeconds = b.durationSeconds as number | null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(b, "thumbnailUrl")) {
    if (!isNullableString(b.thumbnailUrl)) {
      errors.thumbnailUrl = ["thumbnailUrl must be a string."];
    } else {
      result.thumbnailUrl = b.thumbnailUrl?.trim() || null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(b, "videoUrl")) {
    if (!isNullableString(b.videoUrl)) {
      errors.videoUrl = ["videoUrl must be a string."];
    } else {
      result.videoUrl = b.videoUrl?.trim() || null;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return result;
}

export class TrainingVideoNotFoundError extends Error {
  constructor() {
    super("Training video not found.");
  }
}

// Covers both "doesn't exist" and "belongs to a different company/is
// platform-authored" in one branch (same idiom as BulkOrderNotOwnedError),
// so a caller maps it straight to 403 without leaking which case it was.
export class TrainingVideoNotOwnedError extends Error {
  constructor() {
    super("You can only manage your own training videos.");
  }
}

// Only a certificate whose earning method is actually tier1_video_quiz makes
// sense to attach to a video's quiz — mirrors createTrainingSession's own
// tier2b_operator_or_sme_signoff check (lib/training-sessions.ts) and
// certificate-signoffs.ts's tier2a_operator_signoff check: each of the three
// earning paths validates the certificate it's handed against its own method,
// so a supplier/admin can't accidentally wire a video's quiz to a
// certificate meant to be earned through an operator/SME session instead.
export class CertificateNotEligibleForVideoError extends Error {
  constructor() {
    super(
      "This certificate is not earned via a video quiz — only certificates with earning method " +
        "tier1_video_quiz can be attached to a training video."
    );
  }
}

async function assertCertificateEligibleForVideo(certificateId: bigint): Promise<void> {
  const certificate = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate || certificate.status !== CertificateStatus.approved) {
    throw new ApiValidationError({ certificateId: ["certificateId does not exist."] });
  }
  if (certificate.earningMethod !== CertificateEarningMethod.tier1_video_quiz) {
    throw new CertificateNotEligibleForVideoError();
  }
}

export async function createTrainingVideo(
  fields: Required<Pick<ParsedTrainingVideoFields, "title" | "category" | "certificateId">> & ParsedTrainingVideoFields,
  companyId: bigint | null
): Promise<TrainingVideo> {
  await assertCertificateEligibleForVideo(fields.certificateId);

  return prisma.trainingVideo.create({
    data: {
      companyId,
      certificateId: fields.certificateId,
      title: fields.title,
      category: fields.category,
      description: fields.description ?? null,
      durationSeconds: fields.durationSeconds ?? null,
      thumbnailUrl: fields.thumbnailUrl ?? null,
      videoUrl: fields.videoUrl ?? null,
    },
  });
}

async function findVideoOr404(id: bigint): Promise<TrainingVideo> {
  const video = await prisma.trainingVideo.findUnique({ where: { id } });
  if (!video) throw new TrainingVideoNotFoundError();
  return video;
}

export async function updateTrainingVideoAsSupplier(
  id: bigint,
  companyId: bigint,
  fields: ParsedTrainingVideoFields
): Promise<TrainingVideo> {
  const existing = await findVideoOr404(id);
  if (existing.companyId === null || existing.companyId !== companyId) {
    throw new TrainingVideoNotOwnedError();
  }
  if (fields.certificateId !== undefined) {
    await assertCertificateEligibleForVideo(fields.certificateId);
  }
  return prisma.trainingVideo.update({ where: { id }, data: fields });
}

export async function updateTrainingVideoAsAdmin(id: bigint, fields: ParsedTrainingVideoFields): Promise<TrainingVideo> {
  await findVideoOr404(id);
  if (fields.certificateId !== undefined) {
    await assertCertificateEligibleForVideo(fields.certificateId);
  }
  return prisma.trainingVideo.update({ where: { id }, data: fields });
}

export async function deleteTrainingVideoAsAdmin(id: bigint): Promise<void> {
  await findVideoOr404(id);
  await prisma.trainingVideo.delete({ where: { id } });
}
