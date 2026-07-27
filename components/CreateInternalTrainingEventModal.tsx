"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";
import CertificatePickerSingle from "@/components/CertificatePickerSingle";
import ParticipantPicker from "@/components/ParticipantPicker";
import { useBuyerOrgMembers } from "@/lib/hooks/useBuyerOrganization";
import {
  useCreateInternalTrainingEvent,
  useAddInternalTrainingParticipant,
} from "@/lib/hooks/useInternalTrainingEvents";
import { ApiRequestError } from "@/lib/api-client";

interface CreateInternalTrainingEventModalProps {
  open: boolean;
  onClose: () => void;
}

interface FailedParticipant {
  userId: string;
  message: string;
}

// Fields in the brief's stated order: title, certificate, training date,
// participants, equipment/technique details, trainer name. The API has no
// batch-create-with-participants call — createInternalTrainingEvent only
// takes the event fields (see lib/internal-training-events.ts) — so
// participants are added one addParticipant call per selected user, after
// the event itself is committed.
export default function CreateInternalTrainingEventModal({ open, onClose }: CreateInternalTrainingEventModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: members } = useBuyerOrgMembers();
  const createEvent = useCreateInternalTrainingEvent();

  const [title, setTitle] = useState("");
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [trainingDate, setTrainingDate] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [equipmentDetails, setEquipmentDetails] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [failedParticipants, setFailedParticipants] = useState<FailedParticipant[]>([]);
  const addParticipant = useAddInternalTrainingParticipant();

  function reset() {
    setTitle("");
    setCertificateId(null);
    setTrainingDate("");
    setParticipantIds([]);
    setEquipmentDetails("");
    setTrainerName("");
    setError(null);
    setCreatedEventId(null);
    setAddedCount(0);
    setFailedParticipants([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function memberName(userId: string) {
    return members?.find((m) => m.id === userId)?.name ?? userId;
  }

  async function addParticipants(eventId: string, userIds: string[]) {
    const results = await Promise.allSettled(
      userIds.map((userId) => addParticipant.mutateAsync({ eventId, userId }))
    );
    const failed: FailedParticipant[] = [];
    let succeeded = 0;
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        succeeded += 1;
      } else {
        const message = result.reason instanceof ApiRequestError ? result.reason.message : "Something went wrong.";
        failed.push({ userId: userIds[i], message });
      }
    });
    setAddedCount((prev) => prev + succeeded);
    setFailedParticipants(failed);
    return failed;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !certificateId || !trainingDate || !equipmentDetails.trim() || !trainerName.trim()) {
      setError("Please fill in every field before creating the event.");
      return;
    }

    try {
      const { event } = await createEvent.mutateAsync({
        title: title.trim(),
        trainingDate,
        certificateId,
        equipmentDetails: equipmentDetails.trim(),
        trainerName: trainerName.trim(),
      });
      setCreatedEventId(event.id);

      if (participantIds.length === 0) {
        handleClose();
        router.push(`/internal-training/admin/${event.id}`);
        return;
      }

      const failed = await addParticipants(event.id, participantIds);
      if (failed.length === 0) {
        handleClose();
        router.push(`/internal-training/admin/${event.id}`);
      }
      // If any failed, stay open in the "results" state below so the user
      // can retry or finish and add the rest from the event page instead.
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    }
  }

  async function retryParticipant(userId: string) {
    if (!createdEventId) return;
    try {
      await addParticipant.mutateAsync({ eventId: createdEventId, userId });
      setAddedCount((prev) => prev + 1);
      setFailedParticipants((prev) => prev.filter((f) => f.userId !== userId));
    } catch {
      // Leave it in the failed list — the message doesn't need updating for
      // a repeat failure, the row is still visible with a Retry button.
    }
  }

  function finishToEvent() {
    if (!createdEventId) return;
    const eventId = createdEventId;
    handleClose();
    router.push(`/internal-training/admin/${eventId}`);
  }

  const isResultsState = createdEventId !== null && failedParticipants.length > 0;

  return (
    <Modal open={open} onClose={handleClose} className="max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-6">New Internal Training Event</h2>

      {isResultsState ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-body-text">
            Event created. {addedCount} of {addedCount + failedParticipants.length} participants added.
          </p>
          <div className="flex flex-col gap-2">
            {failedParticipants.map((f) => (
              <div key={f.userId} className="flex items-center justify-between border border-border rounded p-3">
                <div>
                  <p className="text-sm font-medium text-body-text">{memberName(f.userId)}</p>
                  <p className="text-xs text-error-red">{f.message}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => retryParticipant(f.userId)}
                  disabled={addParticipant.isPending}
                  className="h-8 px-3 text-xs"
                >
                  Retry
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-text">
            You can add any remaining participants from the event page instead.
          </p>
          <Button onClick={finishToEvent} className="!bg-gradient-to-r !from-ca-emerald-start !to-ca-emerald-end">
            Done — Go to Event
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted-text">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Gravimetric Calibration Refresher"
              className="w-full mt-1.5 focus:!border-ca-emerald-start"
            />
          </div>

          <CertificatePickerSingle value={certificateId} onChange={setCertificateId} />

          <div>
            <label className="text-xs text-muted-text">Training Date</label>
            <Input
              type="date"
              value={trainingDate}
              onChange={(e) => setTrainingDate(e.target.value)}
              className="w-full mt-1.5 focus:!border-ca-emerald-start"
            />
          </div>

          <ParticipantPicker
            value={participantIds}
            onChange={setParticipantIds}
            excludeUserIds={session?.user.id ? [session.user.id] : []}
          />

          <div>
            <label className="text-xs text-muted-text">Equipment / Technique Details</label>
            <textarea
              value={equipmentDetails}
              onChange={(e) => setEquipmentDetails(e.target.value)}
              placeholder="What equipment or technique was this training on?"
              rows={3}
              className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-2.5 focus:outline-none focus:border-ca-emerald-start transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-text">Trainer Name</label>
            <Input
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              placeholder="Who conducted and assessed the training?"
              className="w-full mt-1.5 focus:!border-ca-emerald-start"
            />
            <p className="text-xs text-muted-text mt-1.5">
              The person who actually conducted and assessed the training — this may not be you.
            </p>
          </div>

          {error && <p className="text-sm text-error-red">{error}</p>}

          <Button
            type="submit"
            disabled={createEvent.isPending || addParticipant.isPending}
            className="!bg-gradient-to-r !from-ca-emerald-start !to-ca-emerald-end"
          >
            {createEvent.isPending || addParticipant.isPending ? "Creating…" : "Create Event"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
