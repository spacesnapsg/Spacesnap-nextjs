"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, X } from "lucide-react";
import { useEvidenceUpload } from "@/lib/hooks/useEvidenceUpload";
import type { InternalTrainingParticipant } from "@/lib/hooks/useInternalTrainingEvents";

interface EvidenceUploadFieldProps {
  eventId: string;
  participantId: string;
  hasEvidence: boolean;
  onUploaded?: (participant: InternalTrainingParticipant) => void;
}

// Adapted from components/ImageUploadField.tsx's dashed-box/preview/spinner
// UI, but accepts image/* OR application/pdf (a gravimetric-check photo or
// a calibration printout, per the brief's own examples) — a PDF gets a
// static "file attached" state instead of an <img> preview.
export default function EvidenceUploadField({ eventId, participantId, hasEvidence, onUploaded }: EvidenceUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const upload = useEvidenceUpload(eventId, participantId);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileIsImage = file.type.startsWith("image/");
    setIsPdf(!fileIsImage);
    setFileName(file.name);
    setPreviewUrl(fileIsImage ? URL.createObjectURL(file) : null);

    upload.mutate(file, {
      onSuccess: ({ participant }) => onUploaded?.(participant),
      onError: () => {
        setPreviewUrl(null);
        setFileName(null);
      },
    });
  }

  return (
    <div>
      <label
        className={`flex items-center justify-center gap-2 h-24 rounded border border-dashed border-border/60 text-muted-text text-sm overflow-hidden relative ${
          upload.isPending ? "cursor-wait" : "cursor-pointer hover:border-border"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : fileName && isPdf ? (
          <span className="flex items-center gap-1.5">
            <FileText size={16} /> {fileName}
          </span>
        ) : hasEvidence ? (
          <span className="flex items-center gap-1.5">
            <FileText size={16} /> Evidence uploaded
          </span>
        ) : (
          <>
            <ImageIcon size={16} />
            Upload evidence (image or PDF)
          </>
        )}
        {upload.isPending && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-body-text" />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          disabled={upload.isPending}
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
      {(previewUrl || fileName) && !upload.isPending && (
        <button
          type="button"
          onClick={() => {
            setPreviewUrl(null);
            setFileName(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="mt-1.5 flex items-center gap-1 text-xs text-muted-text hover:text-body-text"
        >
          <X size={12} /> Clear preview
        </button>
      )}
      {upload.isError && <p className="mt-1.5 text-xs text-error-red">{(upload.error as Error).message}</p>}
    </div>
  );
}
