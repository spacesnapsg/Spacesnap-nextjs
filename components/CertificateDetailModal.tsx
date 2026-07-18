import { CheckCircle2 } from "lucide-react";
import Modal from "@/components/Modal";
import type { Certificate, UserCertificate } from "@/lib/mockPassport";

const VERIFICATION_LABELS: Record<Certificate["verification_method"], string> = {
  platform: "Platform Verified",
  external: "Externally Verified",
  combined: "Platform + External Verification",
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface CertificateDetailModalProps {
  certificate: Certificate | null;
  userCertificate: UserCertificate | null;
  onClose: () => void;
}

export default function CertificateDetailModal({
  certificate,
  userCertificate,
  onClose,
}: CertificateDetailModalProps) {
  const showVerifiedBy =
    certificate?.verification_method !== "platform" && !!certificate?.verified_by;

  return (
    <Modal open={!!certificate} onClose={onClose} className="w-full max-w-[520px]">
      {certificate && userCertificate && (
        <div className="flex flex-col gap-4 pr-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{certificate.icon}</span>
            <div>
              <h3 className="font-semibold text-body-text text-lg leading-snug">
                {certificate.name}
              </h3>
              <span className="inline-flex items-center gap-1.5 mt-1.5 bg-success-green/15 text-success-green border border-success-green/30 rounded-full px-2.5 py-1 text-xs font-medium">
                <CheckCircle2 size={12} />
                Earned
              </span>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4">
            <p className="text-xs font-semibold text-muted-text tracking-wide mb-4">
              CERTIFICATE DETAILS
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-muted-text text-xs">Certificate ID</p>
                <p className="text-body-text mt-0.5">
                  CERT-{String(certificate.id).padStart(6, "0")}
                </p>
              </div>
              <div>
                <p className="text-muted-text text-xs">Category</p>
                <p className="text-body-text mt-0.5">{certificate.category}</p>
              </div>
              <div>
                <p className="text-muted-text text-xs">Required For</p>
                <p className="text-body-text mt-0.5">{certificate.required_for}</p>
              </div>
              <div>
                <p className="text-muted-text text-xs">Earning Method</p>
                <p className="text-body-text mt-0.5">{certificate.earning_method}</p>
              </div>
              <div>
                <p className="text-muted-text text-xs">Verification Method</p>
                <p className="text-body-text mt-0.5">
                  {VERIFICATION_LABELS[certificate.verification_method]}
                </p>
              </div>
              {showVerifiedBy && (
                <div>
                  <p className="text-muted-text text-xs">Verified By</p>
                  <p className="text-body-text mt-0.5">{certificate.verified_by}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 flex justify-between text-sm">
            <span className="text-muted-text">Earned {formatDate(userCertificate.earned_date)}</span>
            <span className="text-muted-text">
              {userCertificate.expiry_date
                ? `Expires ${formatDate(userCertificate.expiry_date)}`
                : "No expiration"}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
