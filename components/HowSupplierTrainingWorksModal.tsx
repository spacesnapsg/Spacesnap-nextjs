import Modal from "@/components/Modal";

const HOW_IT_WORKS_IMAGE_URL =
  "https://pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev/marketing/passport/supplier-list-credentials.png";

interface HowSupplierTrainingWorksModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HowSupplierTrainingWorksModal({ open, onClose }: HowSupplierTrainingWorksModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[640px]">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-body-text text-lg">How it works</h3>
          <p className="text-sm text-muted-text mt-1">
            Two ways to run training here — use whichever fits the certificate.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HOW_IT_WORKS_IMAGE_URL}
          alt="How supplier training works: Video Tutorials and Training Sessions"
          className="w-full rounded-card border border-border/40"
        />
      </div>
    </Modal>
  );
}
