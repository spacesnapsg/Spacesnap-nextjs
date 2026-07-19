"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Check, X, Search } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import type { Listing, ListingType } from "@/lib/hooks/useListings";
import { useCreateListing, useUpdateListing, type ListingFormFields } from "@/lib/hooks/useSupplierListings";
import { useCertificateCatalog, type Certificate } from "@/lib/hooks/useCertificates";
import { useSubmitCertificate } from "@/lib/hooks/useSupplierCertificates";
import { CERTIFICATE_CATEGORIES } from "@/lib/certificate-categories";
import { ApiRequestError } from "@/lib/api-client";

interface ListingFormState {
  name: string;
  type: ListingType;
  location: string;
  description: string;
  requiredCertificateIds: string[];
  priceDay: string;
  priceWeek: string;
  priceMonth: string;
  pricePerUnit: string;
  packSize: string;
  stockQuantity: string;
  amenities: string[];
  isAvailable: boolean;
  requireApproval: boolean;
}

const EMPTY_FORM: ListingFormState = {
  name: "",
  type: "space",
  location: "",
  description: "",
  requiredCertificateIds: [],
  priceDay: "",
  priceWeek: "",
  priceMonth: "",
  pricePerUnit: "",
  packSize: "",
  stockQuantity: "",
  amenities: [""],
  isAvailable: true,
  requireApproval: false,
};

function buildInitialForm(listing?: Listing): ListingFormState {
  if (!listing) return EMPTY_FORM;

  return {
    name: listing.name,
    type: listing.type,
    location: listing.location ?? "",
    description: listing.description ?? "",
    requiredCertificateIds: listing.requiredCertificateIds ?? [],
    priceDay: listing.type === "consumables" ? "" : String(listing.priceDay ?? ""),
    priceWeek: listing.type === "consumables" ? "" : String(listing.priceWeek ?? ""),
    priceMonth: listing.type === "consumables" ? "" : String(listing.priceMonth ?? ""),
    pricePerUnit: listing.type === "consumables" ? String(listing.pricePerUnit ?? "") : "",
    packSize: listing.type === "consumables" ? (listing.packSize ?? "") : "",
    stockQuantity: listing.type === "consumables" ? String(listing.stockQuantity ?? "") : "",
    amenities: listing.amenities.length ? listing.amenities : [""],
    isAvailable: listing.isAvailable,
    requireApproval: listing.requireApproval,
  };
}

function toFields(form: ListingFormState): ListingFormFields {
  const isConsumable = form.type === "consumables";
  return {
    name: form.name,
    type: form.type,
    location: form.location || null,
    description: form.description || null,
    amenities: form.amenities.filter((a) => a.trim() !== ""),
    isAvailable: form.isAvailable,
    requireApproval: form.requireApproval,
    priceDay: isConsumable ? null : form.priceDay ? Number(form.priceDay) : null,
    priceWeek: isConsumable ? null : form.priceWeek ? Number(form.priceWeek) : null,
    priceMonth: isConsumable ? null : form.priceMonth ? Number(form.priceMonth) : null,
    pricePerUnit: isConsumable ? (form.pricePerUnit ? Number(form.pricePerUnit) : null) : null,
    stockQuantity: isConsumable ? (form.stockQuantity ? Number(form.stockQuantity) : null) : null,
    packSize: isConsumable ? form.packSize || null : null,
    requiredCertificateIds: form.requiredCertificateIds,
  };
}

interface AddEditListingModalProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  listing?: Listing;
}

export default function AddEditListingModal({ open, onClose, mode, listing }: AddEditListingModalProps) {
  const [form, setForm] = useState<ListingFormState>(() => buildInitialForm(listing));
  const [certDropdownOpen, setCertDropdownOpen] = useState(false);
  const [certSearch, setCertSearch] = useState("");
  const [certCategoryFilter, setCertCategoryFilter] = useState<string | null>(null);
  const [showAddCertForm, setShowAddCertForm] = useState(false);
  const [newCertName, setNewCertName] = useState("");
  const [newCertCategory, setNewCertCategory] = useState("");
  const [pendingNewCerts, setPendingNewCerts] = useState<Certificate[]>([]);
  const { data: catalog } = useCertificateCatalog();
  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const submitCertificate = useSubmitCertificate();

  // Newly-requested certs are pending admin review, so they won't show up in
  // the approved catalog yet — merge them in locally so they stay visible
  // and selected on this listing while it's being drafted.
  const certificateOptions = useMemo(() => {
    const catalogIds = new Set((catalog ?? []).map((c) => c.id));
    return [...(catalog ?? []), ...pendingNewCerts.filter((c) => !catalogIds.has(c.id))];
  }, [catalog, pendingNewCerts]);

  const filteredCertOptions = certificateOptions.filter((cert) => {
    const matchesCategory = !certCategoryFilter || cert.category === certCategoryFilter;
    const matchesSearch = cert.name.toLowerCase().includes(certSearch.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const mutation = mode === "edit" ? updateListing : createListing;
  const errorMessage =
    mutation.error instanceof ApiRequestError ? mutation.error.message : mutation.error ? "Something went wrong." : null;

  function updateField<K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleCert(certId: string) {
    setForm((f) => ({
      ...f,
      requiredCertificateIds: f.requiredCertificateIds.includes(certId)
        ? f.requiredCertificateIds.filter((id) => id !== certId)
        : [...f.requiredCertificateIds, certId],
    }));
  }

  function handleSubmitNewCert() {
    if (!newCertName.trim() || !newCertCategory) return;
    submitCertificate.mutate(
      { name: newCertName.trim(), category: newCertCategory },
      {
        onSuccess: (data) => {
          setPendingNewCerts((prev) => [...prev, data.certificate]);
          setForm((f) => ({ ...f, requiredCertificateIds: [...f.requiredCertificateIds, data.certificate.id] }));
          setNewCertName("");
          setNewCertCategory("");
          setShowAddCertForm(false);
        },
      }
    );
  }

  function updateAmenity(index: number, value: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.map((a, i) => (i === index ? value : a)),
    }));
  }

  function addAmenity() {
    setForm((f) => ({ ...f, amenities: [...f.amenities, ""] }));
  }

  function removeAmenity(index: number) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fields = toFields(form);
    if (mode === "edit" && listing) {
      updateListing.mutate({ id: listing.id, fields }, { onSuccess: onClose });
    } else {
      createListing.mutate(fields, { onSuccess: onClose });
    }
  }

  const isConsumable = form.type === "consumables";

  return (
    <Modal open={open} onClose={onClose} className="max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-6">
        {mode === "edit" ? "Edit Listing" : "Add New Listing"}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-muted-text">Name</label>
          <Input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. Wet Lab Bench - Downtown SF"
            className="w-full mt-1.5 focus:!border-supplier-purple-start"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-text">Type</label>
            <select
              value={form.type}
              onChange={(e) => updateField("type", e.target.value as ListingType)}
              className="w-full mt-1.5 bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-supplier-purple-start transition-colors"
            >
              <option value="space">Space</option>
              <option value="equipment">Equipment</option>
              <option value="consumables">Consumable</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-text">Location</label>
            <Input
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="e.g. San Francisco, CA"
              className="w-full mt-1.5 focus:!border-supplier-purple-start"
            />
          </div>
        </div>

        <div className="relative">
          <label className="text-xs text-muted-text">Certificates Required</label>
          <button
            type="button"
            onClick={() => setCertDropdownOpen((o) => !o)}
            className="w-full mt-1.5 min-h-11 bg-background border border-border/40 rounded px-3 py-2 flex flex-wrap items-center gap-1.5 text-left focus:outline-none focus:border-supplier-purple-start transition-colors"
          >
            {form.requiredCertificateIds.length === 0 ? (
              <span className="text-muted-text text-sm px-1">Select required certificates...</span>
            ) : (
              certificateOptions
                .filter((cert) => form.requiredCertificateIds.includes(cert.id))
                .map((cert) => (
                  <span
                    key={cert.id}
                    className="inline-flex items-center gap-1 bg-supplier-purple-start/15 text-supplier-purple-end border border-supplier-purple-start/30 rounded-full px-2.5 py-1 text-xs"
                  >
                    {cert.name}
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCert(cert.id);
                      }}
                      className="hover:text-error-red transition-colors cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))
            )}
          </button>

          {certDropdownOpen && (
            <div className="absolute z-10 mt-1.5 w-full bg-card border border-border rounded p-2 flex flex-col gap-2 shadow-lg">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-text" />
                <input
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  placeholder="Search certificates..."
                  className="w-full bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-supplier-purple-start transition-colors"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCertCategoryFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    certCategoryFilter === null
                      ? "bg-supplier-purple-start/20 text-supplier-purple-end"
                      : "bg-background text-muted-text hover:text-body-text"
                  }`}
                >
                  All
                </button>
                {CERTIFICATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCertCategoryFilter(cat)}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                      certCategoryFilter === cat
                        ? "bg-supplier-purple-start/20 text-supplier-purple-end"
                        : "bg-background text-muted-text hover:text-body-text"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {filteredCertOptions.length === 0 ? (
                  <p className="text-xs text-muted-text px-3 py-2">No certificates match.</p>
                ) : (
                  filteredCertOptions.map((cert) => {
                    const isSelected = form.requiredCertificateIds.includes(cert.id);
                    const isPending = cert.status === "pending";
                    return (
                      <button
                        key={cert.id}
                        type="button"
                        onClick={() => toggleCert(cert.id)}
                        className={`flex items-center justify-between text-left text-sm rounded-lg px-3 py-2 transition-colors ${
                          isSelected
                            ? "bg-supplier-purple-start/15 text-supplier-purple-end"
                            : "text-body-text hover:bg-background"
                        }`}
                      >
                        <span>
                          {cert.name}
                          {isPending && <span className="text-muted-text text-xs italic"> (pending approval)</span>}
                        </span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border/40 pt-2">
                {showAddCertForm ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      value={newCertName}
                      onChange={(e) => setNewCertName(e.target.value)}
                      placeholder="New certificate name"
                      className="w-full text-sm focus:!border-supplier-purple-start"
                    />
                    <select
                      value={newCertCategory}
                      onChange={(e) => setNewCertCategory(e.target.value)}
                      className="w-full bg-background border border-border/40 text-body-text rounded h-9 px-3 text-sm focus:outline-none focus:border-supplier-purple-start transition-colors"
                    >
                      <option value="" disabled>
                        Required for...
                      </option>
                      {CERTIFICATE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {submitCertificate.error instanceof ApiRequestError && (
                      <p className="text-xs text-error-red">{submitCertificate.error.message}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleSubmitNewCert}
                        disabled={!newCertName.trim() || !newCertCategory || submitCertificate.isPending}
                        className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end flex-1 !h-9 !text-sm disabled:opacity-60"
                      >
                        {submitCertificate.isPending ? "Submitting..." : "Submit for approval"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowAddCertForm(false)}
                        className="text-sm text-muted-text hover:text-body-text px-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddCertForm(true)}
                    className="flex items-center gap-1.5 text-sm text-supplier-purple-start hover:opacity-80 transition-opacity w-fit px-1"
                  >
                    <Plus size={14} />
                    Can&apos;t find it? Add a new certificate
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-text">Upload Image</label>
          <label className="mt-1.5 flex items-center justify-center gap-2 h-24 rounded border border-dashed border-border/60 text-muted-text text-sm cursor-not-allowed">
            <ImageIcon size={18} />
            Image upload coming soon
            <input type="file" disabled className="hidden" />
          </label>
        </div>

        {isConsumable ? (
          <div>
            <label className="text-xs text-muted-text">Pricing &amp; Stock</label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <Input
                type="number"
                value={form.pricePerUnit}
                onChange={(e) => updateField("pricePerUnit", e.target.value)}
                placeholder="Price per unit"
                className="focus:!border-supplier-purple-start"
              />
              <Input
                type="number"
                value={form.stockQuantity}
                onChange={(e) => updateField("stockQuantity", e.target.value)}
                placeholder="Stock quantity"
                className="focus:!border-supplier-purple-start"
              />
              <Input
                value={form.packSize}
                onChange={(e) => updateField("packSize", e.target.value)}
                placeholder="Pack size (e.g. Case of 100)"
                className="col-span-2 focus:!border-supplier-purple-start"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted-text">Pricing</label>
            <div className="grid grid-cols-3 gap-3 mt-1.5">
              <Input
                type="number"
                value={form.priceDay}
                onChange={(e) => updateField("priceDay", e.target.value)}
                placeholder="Daily"
                className="focus:!border-supplier-purple-start"
              />
              <Input
                type="number"
                value={form.priceWeek}
                onChange={(e) => updateField("priceWeek", e.target.value)}
                placeholder="Weekly"
                className="focus:!border-supplier-purple-start"
              />
              <Input
                type="number"
                value={form.priceMonth}
                onChange={(e) => updateField("priceMonth", e.target.value)}
                placeholder="Monthly"
                className="focus:!border-supplier-purple-start"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-text">Amenities</label>
          <div className="flex flex-col gap-2 mt-1.5">
            {form.amenities.map((amenity, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={amenity}
                  onChange={(e) => updateAmenity(i, e.target.value)}
                  placeholder="e.g. Fume Hood"
                  className="flex-1 focus:!border-supplier-purple-start"
                />
                <button
                  type="button"
                  onClick={() => removeAmenity(i)}
                  className="text-muted-text hover:text-error-red transition-colors shrink-0"
                  aria-label="Remove amenity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addAmenity}
              className="flex items-center gap-1.5 text-sm text-supplier-purple-start hover:opacity-80 transition-opacity w-fit"
            >
              <Plus size={14} />
              Add amenity
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-text">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={3}
            placeholder="Describe this listing..."
            className="w-full mt-1.5 bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-supplier-purple-start transition-colors resize-none"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-body-text">Is Available</label>
            <button
              type="button"
              onClick={() => updateField("isAvailable", !form.isAvailable)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.isAvailable ? "bg-supplier-purple-start" : "bg-border"
              }`}
              aria-pressed={form.isAvailable}
              aria-label="Toggle availability"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  form.isAvailable ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-body-text">Require approval</label>
            <button
              type="button"
              onClick={() => updateField("requireApproval", !form.requireApproval)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.requireApproval ? "bg-supplier-purple-start" : "bg-border"
              }`}
              aria-pressed={form.requireApproval}
              aria-label="Toggle require approval"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  form.requireApproval ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {errorMessage && <p className="text-sm text-error-red">{errorMessage}</p>}

        <Button
          type="submit"
          disabled={mutation.isPending}
          className={`w-full !bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end ${
            mutation.isPending ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Modal>
  );
}
