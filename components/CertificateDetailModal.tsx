import { CheckCircle2, Lock } from "lucide-react";
import Modal from "@/components/Modal";
import type { Certificate } from "@/lib/hooks/useCertificates";
import type { Credential } from "@/lib/hooks/useCredentials";
import { PROVENANCE_LABEL, getProvenanceTooltip } from "@/lib/credential-provenance";
import type { CredentialProvenance } from "@/app/generated/prisma/client";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EARNING_METHOD_COPY: Record<string, string> = {
  tier1_video_quiz: "Watch the training video and pass its quiz to earn this certificate.",
  tier2a_operator_signoff: "Submit a recording (or request a live demo) for operator sign-off to earn this certificate.",
  tier2a1_internal_company_signoff:
    "This certificate can also be earned through an in-house training run by your organization admin — check with them for the schedule.",
  tier2b_operator_or_sme_signoff: "Enroll in a scheduled training session and get signed off by the SME to earn this certificate.",
};

interface CertificateDetailModalProps {
  certificate: Certificate | null;
  credential: Credential | null;
  onClose: () => void;
}

export default function CertificateDetailModal({
  certificate,
  credential,
  onClose,
}: CertificateDetailModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = !!(credential?.expiryDate && credential.expiryDate < today);
  const isHeld = !!credential && !isExpired;

  return (
    <Modal open={!!certificate} onClose={onClose} className="w-full max-w-[520px]">
      {certificate && (
        <div className="flex flex-col gap-4 pr-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{certificate.icon}</span>
            <div>
              <h3 className="font-semibold text-body-text text-lg leading-snug">{certificate.name}</h3>
              {isHeld ? (
                <span className="inline-flex items-center gap-1.5 mt-1.5 bg-success-green/15 text-success-green border border-success-green/30 rounded-full px-2.5 py-1 text-xs font-medium">
                  <CheckCircle2 size={12} />
                  Earned
                </span>
              ) : isExpired ? (
                <span className="inline-flex items-center gap-1.5 mt-1.5 bg-error-red/15 text-error-red border border-error-red/30 rounded-full px-2.5 py-1 text-xs font-medium">
                  <Lock size={12} />
                  Expired
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 mt-1.5 bg-amber/15 text-amber border border-amber/30 rounded-full px-2.5 py-1 text-xs font-medium">
                  <Lock size={12} />
                  Not Earned
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-border/40 pt-4">
            <p className="text-xs font-semibold text-muted-text tracking-wide mb-4">CERTIFICATE DETAILS</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-muted-text text-xs">Certificate ID</p>
                {/* Unique to THIS holder's earned credential (UserCertificate.id) —
                    not the shared Certificate definition id, which every holder of
                    this certificate would otherwise see the same value for. */}
                <p className="text-body-text mt-0.5">
                  {credential ? `CRED-${credential.id.padStart(8, "0")}` : "Not yet issued"}
                </p>
              </div>
              <div>
                <p className="text-muted-text text-xs">Required For</p>
                <p className="text-body-text mt-0.5">
                  {certificate.requiredForListingNames && certificate.requiredForListingNames.length > 0
                    ? certificate.requiredForListingNames.join(", ")
                    : "Not required for any current listings"}
                </p>
              </div>
              <div>
                <p className="text-muted-text text-xs">Earning Method</p>
                <p className="text-body-text mt-0.5">
                  {PROVENANCE_LABEL[certificate.earningMethod as CredentialProvenance] ?? certificate.earningMethod}
                </p>
              </div>
              {credential && credential.earnedVia !== "tier1_video_quiz" && (
                <div>
                  <p className="text-muted-text text-xs">Signed Off By</p>
                  <p className="text-body-text mt-0.5">{credential.signedOffBy ?? "—"}</p>
                </div>
              )}
              <div>
                <p className="text-muted-text text-xs">Date of Issuance</p>
                <p className="text-body-text mt-0.5">{credential ? formatDate(credential.earnedDate) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-text text-xs">Expiry Date</p>
                <p className={`mt-0.5 ${isExpired ? "text-error-red" : "text-body-text"}`}>
                  {credential ? (credential.expiryDate ? formatDate(credential.expiryDate) : "No expiration") : "—"}
                </p>
              </div>
            </div>
          </div>

          {credential && (
            <div className="border-t border-border/40 pt-4">
              <span
                title={getProvenanceTooltip(credential.earnedVia as CredentialProvenance) ?? undefined}
                className="self-start inline-flex items-center gap-1.5 bg-white/10 text-body-text border border-white/20 rounded-full px-2.5 py-1 text-xs font-medium"
              >
                {PROVENANCE_LABEL[credential.earnedVia as CredentialProvenance]}
              </span>
            </div>
          )}

          {!isHeld && (
            <div className="border-t border-border/40 pt-4">
              <p className="text-xs font-semibold text-muted-text tracking-wide mb-2">
                {isExpired ? "HOW TO RENEW THIS" : "HOW TO EARN THIS"}
              </p>
              <p className="text-sm text-body-text">
                {EARNING_METHOD_COPY[certificate.earningMethod] ??
                  "Contact the supplier for how to earn this certificate."}
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
