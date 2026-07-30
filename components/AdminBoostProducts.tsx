"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Zap, Pin as PinIcon, FileText, Megaphone, Mail, Star, Tag, type LucideIcon } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import {
  useAdminBoostProducts,
  useAdminCreateBoostProduct,
  useAdminUpdateBoostProduct,
  useAdminDeleteBoostProduct,
  type BoostProduct,
  type BoostProductIconName,
} from "@/lib/hooks/useBoostProducts";
import { ApiRequestError } from "@/lib/api-client";

// Admin CRUD for the "Boost Your Listings" catalogue shown on Supplier
// Profile (components/ListingBoostCatalogueCard.tsx) — see BoostProduct's
// own schema comment for the builtin-vs-custom split this page enforces:
// Bumps/Pin (builtinEffect bump/pin) are seeded once and can only be edited
// or deactivated here, never deleted or newly created — their purchase
// mechanics are hardcoded elsewhere and assume exactly one row of each
// exists. Every other row (builtinEffect "none") is entirely admin-authored
// and freely addable/editable/deletable.

const ICON_OPTIONS: { value: BoostProductIconName; label: string }[] = [
  { value: "zap", label: "Lightning (Zap)" },
  { value: "pin", label: "Pin" },
  { value: "file-text", label: "Document" },
  { value: "megaphone", label: "Megaphone" },
  { value: "mail", label: "Mail" },
  { value: "star", label: "Star" },
  { value: "tag", label: "Tag" },
];

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  pin: PinIcon,
  "file-text": FileText,
  megaphone: Megaphone,
  mail: Mail,
  star: Star,
  tag: Tag,
};

const BUILTIN_LABELS: Record<BoostProduct["builtinEffect"], string> = {
  bump: "Built-in — Bumps",
  pin: "Built-in — Pin",
  none: "Custom",
};

function PriceSummary({ item }: { item: BoostProduct }) {
  if (item.builtinEffect === "pin") {
    return (
      <p className="text-xs text-muted-text">
        {item.pin7PriceCredits ?? 0} credits / 7 days · {item.pin30PriceCredits ?? 0} credits / 30 days
      </p>
    );
  }
  return <p className="text-xs text-muted-text">{item.priceCredits ?? 0} credits each</p>;
}

function BoostProductCard({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  toggleDisabled,
}: {
  item: BoostProduct;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  toggleDisabled: boolean;
}) {
  const Icon = ICON_MAP[item.iconName] ?? Star;
  const isCustom = item.builtinEffect === "none";

  return (
    <div className="bg-card border border-border/10 rounded-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Icon size={16} className="text-admin-orange-end shrink-0" />
          <div className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-admin-orange-end">
              {BUILTIN_LABELS[item.builtinEffect]}
            </span>
            <p className="text-sm font-semibold text-body-text truncate">{item.name}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={onEdit} aria-label="Edit product" className="w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-admin-orange-end transition-colors">
            <Pencil size={14} />
          </button>
          {isCustom && (
            <button type="button" onClick={onDelete} aria-label="Delete product" className="w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-error-red transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-text leading-snug">{item.description}</p>
      <PriceSummary item={item} />

      <button
        type="button"
        disabled={toggleDisabled}
        onClick={onToggleActive}
        className={`self-start h-8 px-3 rounded-full text-xs font-medium border transition-colors ${toggleDisabled ? "opacity-50 cursor-not-allowed" : ""} ${
          item.active
            ? "bg-success-green/15 text-success-green border-success-green/30"
            : "bg-white/10 text-muted-text border-white/20"
        }`}
      >
        {item.active ? "Active" : "Inactive"}
      </button>
    </div>
  );
}

interface FormValues {
  name: string;
  description: string;
  iconName: BoostProductIconName;
  priceCredits: string;
  pin7PriceCredits: string;
  pin30PriceCredits: string;
}

const EMPTY_FORM: FormValues = {
  name: "",
  description: "",
  iconName: "star",
  priceCredits: "0",
  pin7PriceCredits: "0",
  pin30PriceCredits: "0",
};

function formValuesFromItem(item: BoostProduct): FormValues {
  return {
    name: item.name,
    description: item.description,
    iconName: item.iconName,
    priceCredits: (item.priceCredits ?? 0).toString(),
    pin7PriceCredits: (item.pin7PriceCredits ?? 0).toString(),
    pin30PriceCredits: (item.pin30PriceCredits ?? 0).toString(),
  };
}

const selectClassName =
  "bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-admin-red-start transition-colors w-full";
const textareaClassName =
  "bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-admin-red-start transition-colors w-full";

function BoostProductModal({ open, onClose, initialItem }: { open: boolean; onClose: () => void; initialItem: BoostProduct | null }) {
  const isEdit = !!initialItem;
  const isPin = initialItem?.builtinEffect === "pin";
  const [values, setValues] = useState<FormValues>(initialItem ? formValuesFromItem(initialItem) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createProduct = useAdminCreateBoostProduct();
  const updateProduct = useAdminUpdateBoostProduct();
  const saving = createProduct.isPending || updateProduct.isPending;

  // Reset form state whenever the modal transitions into the open state
  // (fresh add, or editing a different item) — same "adjust state during
  // render when a prop changes" pattern as AdminRewards' RewardItemModal.
  const resetKey = open ? `open:${initialItem?.id ?? "new"}` : "closed";
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setValues(initialItem ? formValuesFromItem(initialItem) : EMPTY_FORM);
      setError(null);
    }
  }

  function resetAndClose() {
    setValues(EMPTY_FORM);
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await updateProduct.mutateAsync({
          id: initialItem.id,
          name: values.name.trim(),
          description: values.description.trim(),
          iconName: values.iconName,
          ...(isPin
            ? { pin7PriceCredits: Number(values.pin7PriceCredits), pin30PriceCredits: Number(values.pin30PriceCredits) }
            : { priceCredits: Number(values.priceCredits) }),
        });
      } else {
        await createProduct.mutateAsync({
          name: values.name.trim(),
          description: values.description.trim(),
          iconName: values.iconName,
          priceCredits: Number(values.priceCredits),
        });
      }
      resetAndClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    }
  }

  return (
    <Modal open={open} onClose={resetAndClose} className="w-full max-w-[560px]">
      <h2 className="text-lg font-semibold text-body-text mb-6">{isEdit ? "Edit Boost Product" : "Add Boost Product"}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input placeholder="Name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />

        <textarea
          placeholder="Description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className={textareaClassName}
          rows={2}
          required
        />

        <div>
          <label className="block text-xs text-muted-text mb-1">Icon</label>
          <select
            value={values.iconName}
            onChange={(e) => setValues((v) => ({ ...v, iconName: e.target.value as BoostProductIconName }))}
            className={selectClassName}
          >
            {ICON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isPin ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-text mb-1">7-day price (credits)</label>
              <Input
                type="number"
                min={1}
                value={values.pin7PriceCredits}
                onChange={(e) => setValues((v) => ({ ...v, pin7PriceCredits: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-text mb-1">30-day price (credits)</label>
              <Input
                type="number"
                min={1}
                value={values.pin30PriceCredits}
                onChange={(e) => setValues((v) => ({ ...v, pin30PriceCredits: e.target.value }))}
                required
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-muted-text mb-1">Price per unit (credits)</label>
            <Input
              type="number"
              min={1}
              value={values.priceCredits}
              onChange={(e) => setValues((v) => ({ ...v, priceCredits: e.target.value }))}
              required
            />
          </div>
        )}

        {error && <p className="text-sm text-error-red bg-error-red/10 border border-error-red/30 rounded px-4 py-3">{error}</p>}

        <Button type="submit" disabled={saving} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end mt-2">
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
        </Button>
      </form>
    </Modal>
  );
}

function DeleteBoostProductModal({ item, onCancel, onConfirm }: { item: BoostProduct | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open={!!item} onClose={onCancel} className="w-full max-w-[400px]">
      <h2 className="text-lg font-semibold text-body-text mb-2">Delete this product?</h2>
      <p className="text-sm text-muted-text mb-6">{item ? `"${item.name}" will be permanently removed from the catalogue.` : ""}</p>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onCancel} className="h-9 px-4 text-sm">
          Cancel
        </Button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-9 px-4 rounded text-sm font-medium border border-error-red text-error-red hover:bg-error-red/10 transition-colors"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}

export default function AdminBoostProducts() {
  const { data, isLoading, isError } = useAdminBoostProducts();
  const [modalState, setModalState] = useState<{ open: boolean; item: BoostProduct | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<BoostProduct | null>(null);
  const updateProduct = useAdminUpdateBoostProduct();
  const deleteProduct = useAdminDeleteBoostProduct();

  const products = data ?? [];

  function handleToggleActive(item: BoostProduct) {
    updateProduct.mutate({ id: item.id, active: !item.active });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteProduct.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Boost Products
        </h1>
        <p className="text-muted-text mt-1">
          Manage the &quot;Boost Your Listings&quot; catalogue shown on Supplier Profile — however many active products exist here is
          however many cards suppliers see.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-body-text">Catalogue</h2>
          <Button onClick={() => setModalState({ open: true, item: null })} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end gap-2">
            <Plus size={16} />
            Add Product
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-text text-center py-12">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-error-red text-center py-12">Failed to load boost products.</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-text text-center py-12">No boost products yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((item) => (
              <BoostProductCard
                key={item.id}
                item={item}
                onEdit={() => setModalState({ open: true, item })}
                onDelete={() => setDeleteTarget(item)}
                onToggleActive={() => handleToggleActive(item)}
                toggleDisabled={updateProduct.isPending && updateProduct.variables?.id === item.id}
              />
            ))}
          </div>
        )}
      </Card>

      <BoostProductModal open={modalState.open} initialItem={modalState.item} onClose={() => setModalState({ open: false, item: null })} />
      <DeleteBoostProductModal item={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} />
    </div>
  );
}
