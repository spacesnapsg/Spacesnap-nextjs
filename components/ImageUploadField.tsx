"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { useImageUpload } from "@/lib/hooks/useImageUpload";

interface ImageUploadFieldProps {
  uploadUrlEndpoint: string;
  // Public URL of the currently-saved image, if any — shown as the initial
  // preview before the caller picks a new file.
  currentImageUrl?: string | null;
  onUploaded: (key: string) => void;
  label?: string;
}

// Sprint 6.12 — the first real file-input UI in this app (see
// lib/hooks/useImageUpload.ts's own comment). Deliberately dumb: it only
// handles picking a file, showing a preview, and reporting the uploaded
// key back to the caller via onUploaded — the caller is responsible for
// its own save mutation (setAdminEdmCampaign, setBanner, etc.), same
// separation every other form field in this app already follows.
export default function ImageUploadField({ uploadUrlEndpoint, currentImageUrl, onUploaded, label = "Image" }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl ?? null);
  const upload = useImageUpload(uploadUrlEndpoint);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    upload.mutate(file, {
      onSuccess: ({ key }) => onUploaded(key),
      onError: () => setPreviewUrl(currentImageUrl ?? null),
    });
  }

  return (
    <div>
      <label className="text-xs text-muted-text">{label}</label>
      <label
        className={`mt-1.5 flex items-center justify-center gap-2 h-32 rounded border border-dashed border-border/60 text-muted-text text-sm overflow-hidden relative ${
          upload.isPending ? "cursor-wait" : "cursor-pointer hover:border-border"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <>
            <ImageIcon size={18} />
            Click to upload an image
          </>
        )}
        {upload.isPending && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-body-text" />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={upload.isPending}
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
      {previewUrl && !upload.isPending && (
        <button
          type="button"
          onClick={() => {
            setPreviewUrl(null);
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
