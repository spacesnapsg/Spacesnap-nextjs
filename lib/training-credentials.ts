import { ActivityActionType, type Prisma, type UserCertificate } from "@/app/generated/prisma/client";

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
  params: { userId: string; certificateId: bigint; description: string }
): Promise<UserCertificate> {
  const credential = await tx.userCertificate.upsert({
    where: { userId_certificateId: { userId: params.userId, certificateId: params.certificateId } },
    create: {
      userId: params.userId,
      certificateId: params.certificateId,
      earnedDate: new Date(),
    },
    update: {
      earnedDate: new Date(),
      expiryDate: null,
    },
  });

  await tx.activityLog.create({
    data: {
      userId: params.userId,
      actionType: ActivityActionType.credential_issued,
      description: params.description,
    },
  });

  return credential;
}
