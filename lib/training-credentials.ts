import {
  ActivityActionType,
  AdminNotificationType,
  CredentialProvenance,
  InternalTrainingParticipantStatus,
  TrainingEnrollmentStatus,
  type Prisma,
  type UserCertificate,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminNotification } from "@/lib/admin-notifications";
import { resolveProvenanceOnRenewal } from "@/lib/credential-provenance";

// Shared by both credentialing paths built for Sprint 4, Item 4 —
// lib/quiz-attempts.ts (tier1_video_quiz, auto-graded) and
// lib/training-enrollments.ts's updateEnrollmentStatus (tier2a/2b operator-
// or-SME sign-off, reusing the existing training_enrollments status column).
// Neither the old app nor this rewrite ever had a confirmed trigger for
// user_certificates creation before this item (CODEBASEAPI_SUMMARY.md §6:
// "no confirmed trigger exists in the traced code... may be manual admin
// action, automatic on some condition, or genuinely unbuilt") — this is that
// trigger, built once and reused by both earning paths rather than
// duplicated.
//
// Must be called with a transaction client (tx) so issuance is atomic with
// whatever caused it (the quiz-attempt insert, or the enrollment status
// update) — same "one $transaction per real-world event" idiom as every
// other write path in this app (createBookingWithDebit, createCheckIn, etc).
//
// Upserts rather than always-creates: UserCertificate has a
// @@unique([userId, certificateId]) constraint, and re-earning an
// already-held certificate (e.g. a fresh pass after the prior one expired)
// should renew earnedDate/clear expiryDate rather than throw. This is a new
// mechanism, not a port, so there's no old-app renewal behavior to diverge
// from — see the schema's own "renewal-by-video flow deferred, column ready"
// comment on UserCertificate.expiryDate.
export async function issueCredential(
  tx: Prisma.TransactionClient,
  params: { userId: string; certificateId: bigint; description: string; provenance: CredentialProvenance }
): Promise<UserCertificate> {
  // Provenance must never be silently downgraded on renewal (e.g. an
  // internal sign-off re-earning a credential someone already holds via
  // operator sign-off) — resolve against whatever's already on the row, if
  // anything, before writing. See lib/credential-provenance.ts.
  const existing = await tx.userCertificate.findUnique({
    where: { userId_certificateId: { userId: params.userId, certificateId: params.certificateId } },
    select: { earnedVia: true },
  });
  const earnedVia = existing ? resolveProvenanceOnRenewal(existing.earnedVia, params.provenance) : params.provenance;

  const credential = await tx.userCertificate.upsert({
    where: { userId_certificateId: { userId: params.userId, certificateId: params.certificateId } },
    create: {
      userId: params.userId,
      certificateId: params.certificateId,
      earnedDate: new Date(),
      earnedVia,
    },
    update: {
      earnedDate: new Date(),
      expiryDate: null,
      earnedVia,
    },
  });

  await tx.activityLog.create({
    data: {
      userId: params.userId,
      actionType: ActivityActionType.credential_issued,
      description: params.description,
    },
  });

  const [certificate, user] = await Promise.all([
    tx.certificate.findUniqueOrThrow({ where: { id: params.certificateId } }),
    tx.user.findUniqueOrThrow({ where: { id: params.userId }, select: { name: true } }),
  ]);
  await tx.notification.create({
    data: {
      userId: params.userId,
      type: "cert_earned",
      title: "Certification earned",
      message: `You earned the "${certificate.name}" certification.`,
      relatedCertificateId: params.certificateId,
    },
  });
  await createAdminNotification(tx, {
    type: AdminNotificationType.new_credential,
    title: "New credential earned",
    message: `${user.name} earned the "${certificate.name}" credential.`,
    relatedUserId: params.userId,
    relatedCertificateId: params.certificateId,
  });

  return credential;
}

// Digital Passport's certificate detail view (session:
// certificate-detail-fields) needs to show who signed a held credential off,
// but "who" lives on a different table per earning path — there's no single
// FK for it on UserCertificate itself. tier1_video_quiz is auto-graded (no
// human reviewer, see QuizAttempt's own comment), so it resolves to null;
// the other three each look up their own earning path's record:
//   - tier2a_operator_signoff: CertificateSignoffRequest.reviewedBy
//   - tier2a1_internal_company_signoff: InternalTrainingEvent.trainerName
//     (the person who actually ran the training — see that model's own
//     comment on why this isn't necessarily the CA doing the signing-off;
//     there's no separate "reviewedBy" column on the participant row)
//   - tier2b_operator_or_sme_signoff: TrainingSession.smeName
// Read-only lookups, not part of the issuance transaction above — this is
// display-time resolution, called from GET /api/credentials.
export async function resolveSignedOffBy(
  userId: string,
  certificateId: bigint,
  earnedVia: CredentialProvenance
): Promise<string | null> {
  switch (earnedVia) {
    case CredentialProvenance.tier2a_operator_signoff: {
      const request = await prisma.certificateSignoffRequest.findUnique({
        where: { userId_certificateId: { userId, certificateId } },
        include: { reviewer: { select: { name: true } } },
      });
      return request?.reviewer?.name ?? null;
    }
    case CredentialProvenance.tier2a1_internal_company_signoff: {
      const participant = await prisma.internalTrainingParticipant.findFirst({
        where: { userId, status: InternalTrainingParticipantStatus.passed, event: { certificateId } },
        include: { event: { select: { trainerName: true } } },
        orderBy: { reviewedAt: "desc" },
      });
      return participant?.event.trainerName ?? null;
    }
    case CredentialProvenance.tier2b_operator_or_sme_signoff: {
      const enrollment = await prisma.trainingEnrollment.findFirst({
        where: { userId, status: TrainingEnrollmentStatus.completed, trainingSession: { certificateId } },
        include: { trainingSession: { select: { smeName: true } } },
        orderBy: { updatedAt: "desc" },
      });
      return enrollment?.trainingSession.smeName ?? null;
    }
    default:
      return null;
  }
}
