// Certificate-set gating (Sprint 4, item 2 — revised scope). Replaces the
// scrapped tier-comparison design: "tier" is just a label for how a
// certificate was earned (see CertificateEarningMethod), not a level of
// achievement, so there is nothing to compare numerically. Gating a booking
// is a plain set difference — required minus (held AND not expired) — not
// an "achieved vs. required" score.
//
// Standalone/pure so it can be unit tested without a DB, same pattern as the
// scrapped lib/tiers.ts: operates on plain values, not Prisma models. Not
// named lib/certificates.ts because that file already exists (certificate
// catalog CRUD — parseSubmissionFields/reviewCertificate/etc., Sprint 3
// Session 4) and mixes in Prisma-backed code this module deliberately avoids.

export type CertificateId = string;

export interface HeldCertificate {
  certificateId: CertificateId;
  expiryDate?: Date | string | null;
}

function toTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function isHeldAndNotExpired(held: HeldCertificate, asOf: Date): boolean {
  const expiryTime = toTime(held.expiryDate);
  return expiryTime === null || expiryTime >= asOf.getTime();
}

// required minus (held AND not expired). An expired entry in
// userHeldCertificates counts as not held. Returns only the delta — required
// certificates already held (and unexpired) are omitted, not re-listed.
export function getMissingCertificates(
  requiredCertificateIds: CertificateId[],
  userHeldCertificates: HeldCertificate[],
  asOf: Date = new Date()
): CertificateId[] {
  const heldIds = new Set(
    userHeldCertificates.filter((held) => isHeldAndNotExpired(held, asOf)).map((held) => held.certificateId)
  );
  return requiredCertificateIds.filter((id) => !heldIds.has(id));
}
