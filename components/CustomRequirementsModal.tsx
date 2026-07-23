"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";

type RequirementType = "membership" | "consultancy";

interface CustomRequirementsModalProps {
  open: boolean;
  onClose: () => void;
  type: RequirementType;
}

const COPY: Record<
  RequirementType,
  { title: string; description: string; placeholder: string; submitLabel: string }
> = {
  membership: {
    title: "Submit Membership Inquiry",
    description:
      "Tell us what kind of long-term, dedicated space you're after and we'll connect you with verified space partners.",
    placeholder: "e.g. 500 sqft wet lab in Singapore, 12-month membership starting Q4...",
    submitLabel: "Submit Inquiry",
  },
  consultancy: {
    title: "Request Consultation",
    description:
      "Renovation, space planning, equipment sourcing, consumables, logistics — tell us what you need and one of our consultants will reach out.",
    placeholder: "e.g. Renovating a new BSL-2 lab, sourcing a mass spectrometer, arranging equipment logistics...",
    submitLabel: "Request Consultation",
  },
};

// No backend endpoint exists for membership inquiries / consultancy requests yet —
// this collects the request and shows a confirmation locally. TODO: wire up
// once a MembershipInquiry/ConsultationRequest model + API route lands.
export default function CustomRequirementsModal({ open, onClose, type }: CustomRequirementsModalProps) {
  const [details, setDetails] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const copy = COPY[type];

  function handleClose() {
    setDetails("");
    setContactEmail("");
    setSubmitted(false);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!details.trim()) return;
    setSubmitted(true);
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-full max-w-[480px]">
      {submitted ? (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <CheckCircle2 size={40} className="text-success-green" />
          <h2 className="text-xl font-semibold text-body-text">Request Sent</h2>
          <p className="text-sm text-muted-text">
            Thanks — our team will review your request and get back to you within 1-2 business days.
          </p>
          <Button onClick={handleClose} className="mt-2 w-full">
            Done
          </Button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-body-text mb-1">{copy.title}</h2>
          <p className="text-sm text-muted-text mb-6">{copy.description}</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted-text">Details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                required
                placeholder={copy.placeholder}
                className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-user-teal-start transition-colors resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-text">Contact email (optional)</label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full mt-1.5"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!details.trim()}
                className={`flex-1 ${!details.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {copy.submitLabel}
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
