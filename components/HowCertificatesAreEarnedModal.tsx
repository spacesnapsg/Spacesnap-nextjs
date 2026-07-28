import Modal from "@/components/Modal";

const EARNING_INFOGRAPHIC_URL = "https://pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev/marketing/passport/user-credentials-earned.png";

interface HowCertificatesAreEarnedModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HowCertificatesAreEarnedModal({ open, onClose }: HowCertificatesAreEarnedModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[640px]">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-body-text text-lg">How certificates are earned</h3>
          <p className="text-sm text-muted-text mt-1">
            Each certificate uses one of these paths — check its detail card to see which one applies.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EARNING_INFOGRAPHIC_URL}
          alt="How certificates are earned: Watch & Quiz, Operator Sign-off, and SME Sign-off"
          className="w-full rounded-card border border-border/40"
        />
      </div>
    </Modal>
  );
}
