import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Sprint 6.12 — the first client-side file-input upload flow in this app
// (AddEditListingModal/UploadVideoModal's "upload" fields were always
// disabled stubs, never wired). One shared hook: the mechanics are
// identical across every consumer (admin EDM, supplier EDM, admin banner)
// — request a presigned URL, PUT the raw file to R2, hand back the
// resulting key for the caller's own save mutation. Only the presign
// endpoint differs per consumer, passed in by the caller.
export function useImageUpload(uploadUrlEndpoint: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(uploadUrlEndpoint, {
        method: "POST",
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });

      // Plain fetch, not apiFetch — apiFetch always sends/expects JSON, but
      // R2 needs the raw file bytes as the body with a matching
      // Content-Type header, same as the presigned-PUT contract every other
      // consumer of lib/storage.ts's upload URLs already follows.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) {
        throw new Error("Image upload failed. Please try again.");
      }

      return { key };
    },
  });
}
