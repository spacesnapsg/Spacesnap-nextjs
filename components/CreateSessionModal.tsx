"use client";

// TODO: still on mock data (lib/mockTutorials.ts) — waiting on this stack's port of
// the old TrainingSessionController (create-session endpoint).
import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import { SESSION_LISTING_OPTIONS, SESSION_CERTIFICATE_OPTIONS } from "@/lib/mockTutorials";

interface SessionFormState {
  listing: string;
  certificate: string;
  dateTime: string;
  location: string;
  maxParticipants: string;
  smeName: string;
  smeEmail: string;
}

const EMPTY_FORM: SessionFormState = {
  listing: "",
  certificate: "",
  dateTime: "",
  location: "",
  maxParticipants: "10",
  smeName: "",
  smeEmail: "",
};

interface CreateSessionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateSessionModal({ open, onClose, onCreated }: CreateSessionModalProps) {
  const [form, setForm] = useState<SessionFormState>(EMPTY_FORM);

  function updateField<K extends keyof SessionFormState>(field: K, value: SessionFormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const isValid = Boolean(form.listing && form.certificate && form.dateTime && form.location && form.smeName);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setForm(EMPTY_FORM);
    onCreated?.();
    onClose();
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} className="max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-6">New Training Session</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-muted-text">Equipment / Listing</label>
          <select
            value={form.listing}
            onChange={(e) => updateField("listing", e.target.value)}
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-supplier-purple-start transition-colors"
          >
            <option value="">Select a listing...</option>
            {SESSION_LISTING_OPTIONS.map((listing) => (
              <option key={listing} value={listing}>
                {listing}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-text">Certificate</label>
          <select
            value={form.certificate}
            onChange={(e) => updateField("certificate", e.target.value)}
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-supplier-purple-start transition-colors"
          >
            <option value="">Select a certificate...</option>
            {SESSION_CERTIFICATE_OPTIONS.map((cert) => (
              <option key={cert} value={cert}>
                {cert}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-text mt-1">This is the cert users will receive on passing</p>
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
          <label className="text-xs text-muted-text">Location</label>
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
            value={form.maxParticipants}
            onChange={(e) => updateField("maxParticipants", e.target.value)}
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <label className="text-xs text-muted-text">SME Email (optional)</label>
            <Input
              type="email"
              value={form.smeEmail}
              onChange={(e) => updateField("smeEmail", e.target.value)}
              placeholder="sme@example.com"
              className="w-full mt-1.5 focus:!border-supplier-purple-start"
            />
          </div>
        </div>
        <p className="text-xs text-muted-text -mt-2">
          If provided, the SME will automatically be emailed a sign-off link
        </p>

        <div className="flex items-center gap-3 mt-2">
          <Button variant="ghost" type="button" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid}
            className="flex-1 !bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Session
          </Button>
        </div>
      </form>
    </Modal>
  );
}
