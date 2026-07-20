"use client";

import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import { useCertificateCatalog } from "@/lib/hooks/useCertificates";
import { useCreateTrainingSession } from "@/lib/hooks/useSupplierTrainingSessions";
import { ApiRequestError } from "@/lib/api-client";

interface SessionFormState {
  title: string;
  certificateId: string;
  dateTime: string;
  location: string;
  capacity: string;
  smeName: string;
  description: string;
  endorsementName: string;
}

const EMPTY_FORM: SessionFormState = {
  title: "",
  certificateId: "",
  dateTime: "",
  location: "",
  capacity: "10",
  smeName: "",
  description: "",
  endorsementName: "",
};

interface CreateSessionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

// Only certificates earned via tier2b_operator_or_sme_signoff can be
// attached to a session — see lib/training-sessions.ts for why (tier1 is
// auto-graded, tier2a is a per-user on-demand review, neither involves a
// scheduled session).
export default function CreateSessionModal({ open, onClose, onCreated }: CreateSessionModalProps) {
  const [form, setForm] = useState<SessionFormState>(EMPTY_FORM);
  const { data: catalog } = useCertificateCatalog();
  const createSession = useCreateTrainingSession();

  const eligibleCertificates = (catalog ?? []).filter((c) => c.earningMethod === "tier2b_operator_or_sme_signoff");

  function updateField<K extends keyof SessionFormState>(field: K, value: SessionFormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const capacityNumber = Number(form.capacity);
  const isValid = Boolean(
    form.title && form.certificateId && form.dateTime && form.smeName && Number.isInteger(capacityNumber) && capacityNumber >= 1
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    createSession.mutate(
      {
        title: form.title,
        certificateId: form.certificateId,
        sessionDatetime: new Date(form.dateTime).toISOString(),
        location: form.location || undefined,
        capacity: capacityNumber,
        smeName: form.smeName,
        description: form.description || undefined,
        endorsementName: form.endorsementName || undefined,
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          onCreated?.();
          onClose();
        },
      }
    );
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    createSession.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} className="max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-6">New Training Session</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-muted-text">Session Title</label>
          <Input
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="e.g. Mass Spectrometry Fundamentals"
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        </div>

        <div>
          <label className="text-xs text-muted-text">Certificate</label>
          <select
            value={form.certificateId}
            onChange={(e) => updateField("certificateId", e.target.value)}
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-supplier-purple-start transition-colors"
          >
            <option value="">Select a certificate...</option>
            {eligibleCertificates.map((cert) => (
              <option key={cert.id} value={cert.id}>
                {cert.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-text mt-1">
            This is the cert users will receive on passing. Only certificates earned via operator/SME sign-off are
            eligible for a session.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-text">Endorsement Name (optional)</label>
          <Input
            value={form.endorsementName}
            onChange={(e) => updateField("endorsementName", e.target.value)}
            placeholder="e.g. Mass Spec Operator Endorsement"
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
          <p className="text-xs text-muted-text mt-1">What the participant walks away having earned.</p>
        </div>

        <div>
          <label className="text-xs text-muted-text">Session Date &amp; Time</label>
          <Input
            type="datetime-local"
            value={form.dateTime}
            onChange={(e) => updateField("dateTime", e.target.value)}
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        </div>

        <div>
          <label className="text-xs text-muted-text">Location (optional)</label>
          <Input
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
            placeholder="e.g. Building A, Room 204"
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        </div>

        <div>
          <label className="text-xs text-muted-text">Max Participants</label>
          <Input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => updateField("capacity", e.target.value)}
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        </div>

        <div>
          <label className="text-xs text-muted-text">SME Name</label>
          <Input
            value={form.smeName}
            onChange={(e) => updateField("smeName", e.target.value)}
            placeholder="e.g. Dr. Sarah Chen"
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        </div>

        <div>
          <label className="text-xs text-muted-text">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={3}
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-2.5 focus:outline-none focus:border-supplier-purple-start transition-colors resize-none"
          />
        </div>

        {createSession.isError && (
          <p className="text-xs text-error-red">
            {createSession.error instanceof ApiRequestError
              ? createSession.error.message
              : "Something went wrong — please try again."}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <Button variant="ghost" type="button" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid || createSession.isPending}
            className="flex-1 !bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createSession.isPending ? "Creating…" : "Create Session"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
