"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import {
  useAdminRewards,
  useAdminCreateReward,
  useAdminUpdateReward,
  useAdminDeleteReward,
  type RewardCatalogueItem,
  type RewardCatalogueItemInput,
  type RewardCategory,
  type RewardDiscountAppliesTo,
} from "@/lib/hooks/useAdminRewards";
import { ApiRequestError } from "@/lib/api-client";

const CATEGORIES: RewardCategory[] = ["discount", "pitch_ticket", "consultancy", "events", "lucky_draw", "tier_upgrade", "consumable"];

const CATEGORY_LABELS: Record<RewardCategory, string> = {
  discount: "Discount",
  pitch_ticket: "Pitch Ticket",
  consultancy: "Consultancy",
  events: "Events",
  lucky_draw: "Lucky Draw",
  tier_upgrade: "Tier Upgrade",
  consumable: "Consumable",
};

const APPLIES_TO_OPTIONS: RewardDiscountAppliesTo[] = ["booking", "equipment"];

const APPLIES_TO_LABELS: Record<RewardDiscountAppliesTo, string> = {
  booking: "Booking",
  equipment: "Equipment",
};

// One line per card summarizing the category-specific fields — kept
// separate from the edit form's own field rendering below.
function CategorySummary({ item }: { item: RewardCatalogueItem }) {
  switch (item.category) {
    case "discount":
      return (
        <p className="text-xs text-muted-text">
          {item.discountPercent ?? 0}% off
          {item.discountAppliesTo.length > 0 && ` · Applies to: ${item.discountAppliesTo.map((a) => APPLIES_TO_LABELS[a]).join(", ")}`}
        </p>
      );
    case "pitch_ticket":
      return <p className="text-xs text-muted-text">Partners: {item.partnerOptions.length > 0 ? item.partnerOptions.join(", ") : "—"}</p>;
    case "consultancy":
      return (
        <p className="text-xs text-muted-text">
          Subject: {item.consultancySubject || "—"} · Partners: {item.partnerOptions.length > 0 ? item.partnerOptions.join(", ") : "—"}
        </p>
      );
    case "events":
      return (
        <p className="text-xs text-muted-text">
          {item.eventName || "—"}
          {item.eventInfo && ` · ${item.eventInfo}`}
        </p>
      );
    case "lucky_draw":
      return (
        <p className="text-xs text-muted-text">
          {item.prizeDescription || "—"} × {item.prizeQuantity ?? 0}
        </p>
      );
    case "tier_upgrade":
      return <p className="text-xs text-muted-text">{item.upgradeDurationMonths ?? 0} month upgrade</p>;
    case "consumable":
      return (
        <p className="text-xs text-muted-text">
          {item.consumableName || "—"} × {item.consumableQuantity ?? 0}
        </p>
      );
  }
}

function RewardCard({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  toggleDisabled,
}: {
  item: RewardCatalogueItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  toggleDisabled: boolean;
}) {
  return (
    <div className="bg-card border border-border/10 rounded-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-block text-[11px] font-medium uppercase tracking-wide text-admin-orange-end mb-1">
            {CATEGORY_LABELS[item.category]}
          </span>
          <p className="text-sm font-semibold text-body-text truncate">{item.name}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={onEdit} aria-label="Edit reward" className="w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-admin-orange-end transition-colors">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete reward" className="w-8 h-8 rounded-full flex items-center justify-center text-muted-text hover:text-error-red transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-text leading-snug">{item.description}</p>
      <CategorySummary item={item} />

      <p className="text-xs text-muted-text">
        {item.creditCost} credits to redeem
        {item.quantityAvailable !== null && ` · ${item.redeemedCount}/${item.quantityAvailable} redeemed`}
      </p>

      <div className="flex flex-wrap gap-2">
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
        {item.fullyRedeemed && (
          <span className="self-start h-8 flex items-center px-3 rounded-full text-xs font-medium border bg-amber/15 text-amber border-amber/30">
            Fully Redeemed
          </span>
        )}
      </div>
    </div>
  );
}

interface RewardFormValues {
  category: RewardCategory;
  name: string;
  description: string;
  creditCost: string;
  quantityAvailable: string;
  discountPercent: string;
  discountAppliesTo: RewardDiscountAppliesTo[];
  partnerOptions: string[];
  consultancySubject: string;
  eventName: string;
  eventInfo: string;
  prizeDescription: string;
  prizeQuantity: string;
  upgradeDurationMonths: string;
  consumableName: string;
  consumableQuantity: string;
}

const EMPTY_FORM: RewardFormValues = {
  category: "discount",
  name: "",
  description: "",
  creditCost: "0",
  quantityAvailable: "",
  discountPercent: "10",
  discountAppliesTo: ["booking"],
  partnerOptions: [],
  consultancySubject: "",
  eventName: "",
  eventInfo: "",
  prizeDescription: "",
  prizeQuantity: "1",
  upgradeDurationMonths: "3",
  consumableName: "",
  consumableQuantity: "1",
};

function formValuesFromItem(item: RewardCatalogueItem): RewardFormValues {
  return {
    category: item.category,
    name: item.name,
    description: item.description,
    creditCost: item.creditCost.toString(),
    quantityAvailable: item.quantityAvailable?.toString() ?? "",
    discountPercent: item.discountPercent?.toString() ?? "10",
    discountAppliesTo: item.discountAppliesTo.length > 0 ? item.discountAppliesTo : ["booking"],
    partnerOptions: item.partnerOptions,
    consultancySubject: item.consultancySubject ?? "",
    eventName: item.eventName ?? "",
    eventInfo: item.eventInfo ?? "",
    prizeDescription: item.prizeDescription ?? "",
    prizeQuantity: item.prizeQuantity?.toString() ?? "1",
    upgradeDurationMonths: item.upgradeDurationMonths?.toString() ?? "3",
    consumableName: item.consumableName ?? "",
    consumableQuantity: item.consumableQuantity?.toString() ?? "1",
  };
}

function buildInput(values: RewardFormValues, active: boolean): RewardCatalogueItemInput {
  const base = {
    category: values.category,
    name: values.name.trim(),
    description: values.description.trim(),
    active,
    creditCost: Number(values.creditCost),
    quantityAvailable: values.quantityAvailable.trim() === "" ? null : Number(values.quantityAvailable),
  };

  switch (values.category) {
    case "discount":
      return { ...base, discountPercent: Number(values.discountPercent), discountAppliesTo: values.discountAppliesTo };
    case "pitch_ticket":
      return { ...base, partnerOptions: values.partnerOptions };
    case "consultancy":
      return { ...base, consultancySubject: values.consultancySubject.trim(), partnerOptions: values.partnerOptions };
    case "events":
      return { ...base, eventName: values.eventName.trim(), eventInfo: values.eventInfo.trim() };
    case "lucky_draw":
      return { ...base, prizeDescription: values.prizeDescription.trim(), prizeQuantity: Number(values.prizeQuantity) };
    case "tier_upgrade":
      return { ...base, upgradeDurationMonths: Number(values.upgradeDurationMonths) };
    case "consumable":
      return { ...base, consumableName: values.consumableName.trim(), consumableQuantity: Number(values.consumableQuantity) };
  }
}

// pitch_ticket/consultancy items now offer a LIST of partners (2026-07-22
// fulfillment session, confirmed with the product owner) — the user picks
// one at redemption time (RewardsCatalogueModal) instead of every item being
// pinned to a single partner.
function PartnerOptionsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function addOption() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || value.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="block text-xs text-muted-text">Partner options</label>
      <div className="flex gap-2">
        <Input
          placeholder="Add a partner (e.g. firm/person name)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <Button type="button" variant="ghost" onClick={addOption} className="h-11 px-4 text-sm shrink-0">
          Add
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-text">No partners added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((option) => (
            <span
              key={option}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background px-3 py-1 text-xs text-body-text"
            >
              {option}
              <button
                type="button"
                onClick={() => onChange(value.filter((o) => o !== option))}
                aria-label={`Remove ${option}`}
                className="text-muted-text hover:text-error-red transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const textareaClassName =
  "bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-admin-red-start transition-colors w-full";
const selectClassName =
  "bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-admin-red-start transition-colors w-full";

function RewardItemModal({ open, onClose, initialItem }: { open: boolean; onClose: () => void; initialItem: RewardCatalogueItem | null }) {
  const isEdit = !!initialItem;
  const [values, setValues] = useState<RewardFormValues>(initialItem ? formValuesFromItem(initialItem) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createReward = useAdminCreateReward();
  const updateReward = useAdminUpdateReward();
  const saving = createReward.isPending || updateReward.isPending;

  // Reset form state whenever the modal transitions into the open state
  // (fresh add, or editing a different item) — this component instance is
  // never unmounted between edits (it's rendered once in AdminRewards), so
  // useState's initializer alone only ever fires on the very first mount.
  // Same "adjust state when a prop changes, during render" pattern as
  // TrainingVideoModal.tsx's resetKey.
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
    const input = buildInput(values, initialItem?.active ?? true);
    try {
      if (isEdit) {
        await updateReward.mutateAsync({ id: initialItem.id, ...input });
      } else {
        await createReward.mutateAsync(input);
      }
      resetAndClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    }
  }

  function toggleAppliesTo(option: RewardDiscountAppliesTo) {
    setValues((v) => ({
      ...v,
      discountAppliesTo: v.discountAppliesTo.includes(option) ? v.discountAppliesTo.filter((a) => a !== option) : [...v.discountAppliesTo, option],
    }));
  }

  return (
    <Modal open={open} onClose={resetAndClose} className="w-full max-w-[560px]">
      <h2 className="text-lg font-semibold text-body-text mb-6">{isEdit ? "Edit Reward" : "Add Reward"}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <select
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as RewardCategory }))}
          className={selectClassName}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <Input placeholder="Name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />

        <textarea
          placeholder="Description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className={textareaClassName}
          rows={2}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-text mb-1">Credit cost</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="Credit cost"
              value={values.creditCost}
              onChange={(e) => setValues((v) => ({ ...v, creditCost: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted-text mb-1">Quantity available (blank = unlimited)</label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={values.quantityAvailable}
              onChange={(e) => setValues((v) => ({ ...v, quantityAvailable: e.target.value }))}
            />
          </div>
        </div>

        {values.category === "discount" && (
          <>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="% off"
              value={values.discountPercent}
              onChange={(e) => setValues((v) => ({ ...v, discountPercent: e.target.value }))}
              required
            />
            <div className="flex flex-wrap gap-4">
              {APPLIES_TO_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm text-body-text">
                  <input type="checkbox" checked={values.discountAppliesTo.includes(option)} onChange={() => toggleAppliesTo(option)} />
                  {APPLIES_TO_LABELS[option]}
                </label>
              ))}
            </div>
          </>
        )}

        {values.category === "pitch_ticket" && (
          <PartnerOptionsEditor
            value={values.partnerOptions}
            onChange={(partnerOptions) => setValues((v) => ({ ...v, partnerOptions }))}
          />
        )}

        {values.category === "consultancy" && (
          <>
            <Input
              placeholder="Subject (e.g. Legal, Accounting, HR)"
              value={values.consultancySubject}
              onChange={(e) => setValues((v) => ({ ...v, consultancySubject: e.target.value }))}
              required
            />
            <PartnerOptionsEditor
              value={values.partnerOptions}
              onChange={(partnerOptions) => setValues((v) => ({ ...v, partnerOptions }))}
            />
          </>
        )}

        {values.category === "events" && (
          <>
            <Input
              placeholder="Event name"
              value={values.eventName}
              onChange={(e) => setValues((v) => ({ ...v, eventName: e.target.value }))}
              required
            />
            <textarea
              placeholder="Event info"
              value={values.eventInfo}
              onChange={(e) => setValues((v) => ({ ...v, eventInfo: e.target.value }))}
              className={textareaClassName}
              rows={2}
            />
          </>
        )}

        {values.category === "lucky_draw" && (
          <>
            <textarea
              placeholder="Prize description"
              value={values.prizeDescription}
              onChange={(e) => setValues((v) => ({ ...v, prizeDescription: e.target.value }))}
              className={textareaClassName}
              rows={2}
              required
            />
            <Input
              type="number"
              min={1}
              placeholder="Prize quantity"
              value={values.prizeQuantity}
              onChange={(e) => setValues((v) => ({ ...v, prizeQuantity: e.target.value }))}
              required
            />
          </>
        )}

        {values.category === "tier_upgrade" && (
          <Input
            type="number"
            min={1}
            placeholder="Duration (months)"
            value={values.upgradeDurationMonths}
            onChange={(e) => setValues((v) => ({ ...v, upgradeDurationMonths: e.target.value }))}
            required
          />
        )}

        {values.category === "consumable" && (
          <>
            <Input
              placeholder="Consumable name"
              value={values.consumableName}
              onChange={(e) => setValues((v) => ({ ...v, consumableName: e.target.value }))}
              required
            />
            <Input
              type="number"
              min={1}
              placeholder="Quantity"
              value={values.consumableQuantity}
              onChange={(e) => setValues((v) => ({ ...v, consumableQuantity: e.target.value }))}
              required
            />
          </>
        )}

        {error && <p className="text-sm text-error-red bg-error-red/10 border border-error-red/30 rounded px-4 py-3">{error}</p>}

        <Button type="submit" disabled={saving} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end mt-2">
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Reward"}
        </Button>
      </form>
    </Modal>
  );
}

function DeleteRewardModal({ item, onCancel, onConfirm }: { item: RewardCatalogueItem | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open={!!item} onClose={onCancel} className="w-full max-w-[400px]">
      <h2 className="text-lg font-semibold text-body-text mb-2">Delete this reward?</h2>
      <p className="text-sm text-muted-text mb-6">{item ? `"${item.name}" will be permanently removed.` : ""}</p>
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

export default function AdminRewards() {
  const { data, isLoading, isError } = useAdminRewards();
  const [modalState, setModalState] = useState<{ open: boolean; item: RewardCatalogueItem | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<RewardCatalogueItem | null>(null);
  const updateReward = useAdminUpdateReward();
  const deleteReward = useAdminDeleteReward();

  const rewards = data ?? [];

  function handleToggleActive(item: RewardCatalogueItem) {
    updateReward.mutate({ id: item.id, category: item.category, name: item.name, description: item.description, active: !item.active });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteReward.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Rewards
        </h1>
        <p className="text-muted-text mt-1">Manage the redemption catalogue shown to users on the Financials page</p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-body-text">Rewards Catalogue</h2>
          <Button onClick={() => setModalState({ open: true, item: null })} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end gap-2">
            <Plus size={16} />
            Add Reward
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-text text-center py-12">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-error-red text-center py-12">Failed to load rewards.</p>
        ) : rewards.length === 0 ? (
          <p className="text-sm text-muted-text text-center py-12">No rewards yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((item) => (
              <RewardCard
                key={item.id}
                item={item}
                onEdit={() => setModalState({ open: true, item })}
                onDelete={() => setDeleteTarget(item)}
                onToggleActive={() => handleToggleActive(item)}
                toggleDisabled={updateReward.isPending && updateReward.variables?.id === item.id}
              />
            ))}
          </div>
        )}
      </Card>

      <RewardItemModal open={modalState.open} initialItem={modalState.item} onClose={() => setModalState({ open: false, item: null })} />
      <DeleteRewardModal item={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} />
    </div>
  );
}
