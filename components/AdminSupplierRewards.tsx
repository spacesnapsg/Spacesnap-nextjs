"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import {
  useAdminSupplierRewards,
  useAdminCreateSupplierReward,
  useAdminUpdateSupplierReward,
  useAdminDeleteSupplierReward,
  type SupplierRewardCatalogueItem,
  type SupplierRewardCatalogueItemInput,
  type SupplierRewardCategory,
  type SupplierReportTargetGroup,
} from "@/lib/hooks/useAdminSupplierRewards";
import { ApiRequestError } from "@/lib/api-client";

const CATEGORIES: SupplierRewardCategory[] = ["report", "ad", "system"];

const CATEGORY_LABELS: Record<SupplierRewardCategory, string> = {
  report: "Report",
  ad: "Ad",
  system: "System (Tier Boost)",
};

const TARGET_GROUP_OPTIONS: SupplierReportTargetGroup[] = ["bookings", "equipment", "consumables"];

const TARGET_GROUP_LABELS: Record<SupplierReportTargetGroup, string> = {
  bookings: "Bookings",
  equipment: "Equipment",
  consumables: "Consumables",
};

function CategorySummary({ item }: { item: SupplierRewardCatalogueItem }) {
  switch (item.category) {
    case "report":
      return (
        <p className="text-xs text-muted-text">
          {item.reportTargetGroups.length > 0
            ? `Covers: ${item.reportTargetGroups.map((g) => TARGET_GROUP_LABELS[g]).join(", ")}`
            : "Platform-wide"}
        </p>
      );
    case "ad":
      return <p className="text-xs text-muted-text">{item.campaignDurationDays ?? 0}-day placement</p>;
    case "system":
      return <p className="text-xs text-muted-text">{item.upgradeDurationMonths ?? 0} month tier boost</p>;
  }
}

function RewardCard({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  toggleDisabled,
}: {
  item: SupplierRewardCatalogueItem;
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
  category: SupplierRewardCategory;
  name: string;
  description: string;
  creditCost: string;
  quantityAvailable: string;
  reportTargetGroups: SupplierReportTargetGroup[];
  campaignDurationDays: string;
  upgradeDurationMonths: string;
}

const EMPTY_FORM: RewardFormValues = {
  category: "report",
  name: "",
  description: "",
  creditCost: "0",
  quantityAvailable: "",
  reportTargetGroups: [],
  campaignDurationDays: "7",
  upgradeDurationMonths: "3",
};

function formValuesFromItem(item: SupplierRewardCatalogueItem): RewardFormValues {
  return {
    category: item.category,
    name: item.name,
    description: item.description,
    creditCost: item.creditCost.toString(),
    quantityAvailable: item.quantityAvailable?.toString() ?? "",
    reportTargetGroups: item.reportTargetGroups,
    campaignDurationDays: item.campaignDurationDays?.toString() ?? "7",
    upgradeDurationMonths: item.upgradeDurationMonths?.toString() ?? "3",
  };
}

function buildInput(values: RewardFormValues, active: boolean): SupplierRewardCatalogueItemInput {
  const base = {
    category: values.category,
    name: values.name.trim(),
    description: values.description.trim(),
    active,
    creditCost: Number(values.creditCost),
    quantityAvailable: values.quantityAvailable.trim() === "" ? null : Number(values.quantityAvailable),
  };

  switch (values.category) {
    case "report":
      return { ...base, reportTargetGroups: values.reportTargetGroups };
    case "ad":
      return { ...base, campaignDurationDays: Number(values.campaignDurationDays) };
    case "system":
      return { ...base, upgradeDurationMonths: Number(values.upgradeDurationMonths) };
  }
}

const textareaClassName =
  "bg-background border border-border/40 text-body-text placeholder:text-muted-text rounded px-4 py-3 focus:outline-none focus:border-admin-red-start transition-colors w-full";
const selectClassName =
  "bg-background border border-border/40 text-body-text rounded h-11 px-4 focus:outline-none focus:border-admin-red-start transition-colors w-full";

function RewardItemModal({
  open,
  onClose,
  initialItem,
}: {
  open: boolean;
  onClose: () => void;
  initialItem: SupplierRewardCatalogueItem | null;
}) {
  const isEdit = !!initialItem;
  const [values, setValues] = useState<RewardFormValues>(initialItem ? formValuesFromItem(initialItem) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createReward = useAdminCreateSupplierReward();
  const updateReward = useAdminUpdateSupplierReward();
  const saving = createReward.isPending || updateReward.isPending;

  // Same "adjust state during render when a prop changes" resetKey pattern
  // as AdminRewards.tsx's own RewardItemModal — this component instance is
  // never unmounted between edits, so useState's initializer alone would
  // only ever fire on the very first mount.
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

  function toggleTargetGroup(option: SupplierReportTargetGroup) {
    setValues((v) => ({
      ...v,
      reportTargetGroups: v.reportTargetGroups.includes(option)
        ? v.reportTargetGroups.filter((g) => g !== option)
        : [...v.reportTargetGroups, option],
    }));
  }

  return (
    <Modal open={open} onClose={resetAndClose} className="w-full max-w-[560px]">
      <h2 className="text-lg font-semibold text-body-text mb-6">{isEdit ? "Edit Reward" : "Add Reward"}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <select
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as SupplierRewardCategory }))}
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

        {values.category === "report" && (
          <div className="flex flex-col gap-2">
            <label className="block text-xs text-muted-text">Target groups (blank = platform-wide)</label>
            <div className="flex flex-wrap gap-4">
              {TARGET_GROUP_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm text-body-text">
                  <input type="checkbox" checked={values.reportTargetGroups.includes(option)} onChange={() => toggleTargetGroup(option)} />
                  {TARGET_GROUP_LABELS[option]}
                </label>
              ))}
            </div>
          </div>
        )}

        {values.category === "ad" && (
          <Input
            type="number"
            min={1}
            placeholder="Campaign duration (days)"
            value={values.campaignDurationDays}
            onChange={(e) => setValues((v) => ({ ...v, campaignDurationDays: e.target.value }))}
            required
          />
        )}

        {values.category === "system" && (
          <Input
            type="number"
            min={1}
            placeholder="Duration (months)"
            value={values.upgradeDurationMonths}
            onChange={(e) => setValues((v) => ({ ...v, upgradeDurationMonths: e.target.value }))}
            required
          />
        )}

        {error && <p className="text-sm text-error-red bg-error-red/10 border border-error-red/30 rounded px-4 py-3">{error}</p>}

        <Button type="submit" disabled={saving} className="!bg-gradient-to-r !from-admin-red-start !to-admin-orange-end mt-2">
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Reward"}
        </Button>
      </form>
    </Modal>
  );
}

function DeleteRewardModal({
  item,
  onCancel,
  onConfirm,
}: {
  item: SupplierRewardCatalogueItem | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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

export default function AdminSupplierRewards() {
  const { data, isLoading, isError } = useAdminSupplierRewards();
  const [modalState, setModalState] = useState<{ open: boolean; item: SupplierRewardCatalogueItem | null }>({ open: false, item: null });
  const [deleteTarget, setDeleteTarget] = useState<SupplierRewardCatalogueItem | null>(null);
  const updateReward = useAdminUpdateSupplierReward();
  const deleteReward = useAdminDeleteSupplierReward();

  const rewards = data ?? [];

  function handleToggleActive(item: SupplierRewardCatalogueItem) {
    updateReward.mutate({ id: item.id, category: item.category, name: item.name, description: item.description, active: !item.active });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteReward.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-body-text">Supplier Rewards Catalogue</h2>
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
    </>
  );
}
