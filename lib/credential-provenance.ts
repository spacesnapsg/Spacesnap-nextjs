import { CredentialProvenance } from "@/app/generated/prisma/client";

// Credential *provenance* — how a specific user earned a specific
// credential, recorded on UserCertificate.earnedVia. Distinct from
// certificates.earningMethod (how a certificate is *defined* to be earned)
// and from certificates.category — see schema.prisma comments on both. Do
// not conflate any of these three.
//
// Pure/DB-free, same "unit-testable without a DB" pattern as
// lib/certificate-gating.ts.

// tier2a1 (internal company sign-off) is the weakest provenance — it's a
// company admin vouching internally, not the operator or an external SME.
// The other three all rank equally above it: there is no ordering between
// tier1/tier2a/tier2b themselves, only "internal vs. everything else."
export const PROVENANCE_RANK: Record<CredentialProvenance, number> = {
  tier2a1_internal_company_signoff: 0,
  tier1_video_quiz: 1,
  tier2a_operator_signoff: 1,
  tier2b_operator_or_sme_signoff: 1,
};

export function isStrongerProvenance(candidate: CredentialProvenance, existing: CredentialProvenance): boolean {
  return PROVENANCE_RANK[candidate] > PROVENANCE_RANK[existing];
}

// A credential's provenance must never be downgraded to internal by a later
// internal sign-off — equal ranks return `existing` unchanged (a no-op, not
// a re-affirmation of the incoming value).
export function resolveProvenanceOnRenewal(
  existing: CredentialProvenance,
  incoming: CredentialProvenance
): CredentialProvenance {
  return isStrongerProvenance(incoming, existing) ? incoming : existing;
}

// An internal (tier2a1) credential only satisfies a listing that has opted
// in to accepting internal sign-off; every other provenance always
// satisfies, regardless of the listing's setting.
export function satisfiesListing(earnedVia: CredentialProvenance, acceptsInternalSignoff: boolean): boolean {
  if (earnedVia === "tier2a1_internal_company_signoff") return acceptsInternalSignoff;
  return true;
}

// Digital Passport provenance badge copy — matches the app's existing
// "sign-off" vocabulary (see CertificateDetailModal.tsx's EARNING_METHOD_COPY)
// rather than inventing "verified X" wording. None of these should read as
// lesser than another; only the tooltip below singles out the one whose
// acceptance actually varies.
export const PROVENANCE_LABEL: Record<CredentialProvenance, string> = {
  tier1_video_quiz: "Video & Quiz",
  tier2a_operator_signoff: "Operator Sign-off",
  tier2a1_internal_company_signoff: "Internal Company Sign-off",
  tier2b_operator_or_sme_signoff: "SME Sign-off",
};

// Only the internal-company variant's acceptance genuinely varies per
// listing (Listing.acceptsInternalSignoff, see satisfiesListing above) — the
// other three always satisfy any listing's requirement, so only this one
// needs an explanatory tooltip.
export function getProvenanceTooltip(earnedVia: CredentialProvenance): string | null {
  if (earnedVia === "tier2a1_internal_company_signoff") {
    return "Earned via internal company sign-off — acceptance varies by listing.";
  }
  return null;
}
