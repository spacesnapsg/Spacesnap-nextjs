"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";

interface CertificateRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; context: string }) => Promise<void>;
}

export default function CertificateRequestModal({ open, onClose, onSubmit }: CertificateRequestModalProps) {
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleClose() {
    setName("");
    setContext("");
    setError("");
    setSuccess(false);
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(false);

    if (!name.trim() || !context.trim()) {
      setError("Please fill in both fields before submitting.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), context: context.trim() });
      setName("");
      setContext("");
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch {
      setError("Something went wrong submitting your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[520px]">
      <h2 className="text-xl font-semibold text-body-text mb-1">Request New Certificate</h2>
      <p className="text-sm text-muted-text mb-6">
        Submit a certificate for admin review to add to the certificate pool
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-body-text mb-1.5" htmlFor="cert-name">
            Certificate name
          </label>
          <Input
            id="cert-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Biosafety Level 3 (BSL-3)"
            className="w-full focus:!border-supplier-purple-start"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-body-text mb-1.5" htmlFor="cert-context">
            Context / justification
          </label>
          <textarea
            id="cert-context"
            rows={4}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Explain what this certificate covers and why it's needed"
            required
            className="w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-supplier-purple-start transition-colors resize-none"
          />
        </div>

        {error && <p className="text-sm text-error-red">{error}</p>}
        {success && <p className="text-sm text-success-green">Request submitted for review</p>}

        <Button
          type="submit"
          disabled={submitting}
          className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end w-full disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit for Approval"}
        </Button>
      </form>
    </Modal>
  );
}
