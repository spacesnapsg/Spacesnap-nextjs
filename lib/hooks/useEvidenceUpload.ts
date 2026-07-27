import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { InternalTrainingParticipant } from "@/lib/hooks/useInternalTrainingEvents";

// Internal training evidence upload — same presigned-PUT R2 mechanics as
// lib/hooks/useImageUpload.ts, but this flow needs a second "confirm" call
// the generic image-upload hook doesn't have: the evidence route verifies
// the object actually exists in R2 before recording the key on the
// participant row (see app/api/internal-training-events/[id]/participants/
// [participantId]/{upload-url,evidence}/route.ts). Not a second storage
// mechanism, just the two calls those routes already require.
export function useEvidenceUpload(eventId: string, participantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        `/api/internal-training-events/${eventId}/participants/${participantId}/upload-url`,
        { method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type }) }
      );

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) {
        throw new Error("Evidence upload failed. Please try again.");
      }

      return apiFetch<{ participant: InternalTrainingParticipant }>(
        `/api/internal-training-events/${eventId}/participants/${participantId}/evidence`,
        { method: "POST", body: JSON.stringify({ key }) }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-training-events", "org", eventId] });
      queryClient.invalidateQueries({ queryKey: ["internal-training-events", "org"] });
      queryClient.invalidateQueries({ queryKey: ["internal-training-events", "mine"] });
    },
  });
}
