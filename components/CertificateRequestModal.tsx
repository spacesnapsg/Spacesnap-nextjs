"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useSubmitCertificate } from "@/lib/hooks/useSupplierCertificates";
import { ApiRequestError } from "@/lib/api-client";

interface CertificateRequestModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CertificateRequestModal({ open, onClose }: CertificateRequestModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const submitCertificate = useSubmitCertificate();

  function handleClose() {
    setName("");
    setCategory("");
    submitCertificate.reset();
    onClose();
  }

  const errorMessage =
    submitCertificate.error instanceof ApiRequestError
      ? submitCertificate.error.message
      : submitCertificate.error
        ? "Something went wrong."
        : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    submitCertificate.mutate(
      { name: name.trim(), category: category.trim() || null },
      {
        onSuccess: () => {
          setTimeout(handleClose, 1000);
        },
      }
    );
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
          <label className="block text-sm font-medium text-body-text mb-1.5" htmlFor="cert-category">
            Category (optional)
          </label>
          <Input
            id="cert-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Safety"
            className="w-full focus:!border-supplier-purple-start"
          />
        </div>

        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}
        {submitCertificate.isSuccess && (
          <p className="text-sm text-success-green">Request submitted for review</p>
        )}

        <Button
          type="submit"
          disabled={submitCertificate.isPending}
          className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end w-full disabled:opacity-60"
        >
          {submitCertificate.isPending ? "Submitting..." : "Submit for Approval"}
        </Button>
      </form>
    </Modal>
  );
}
