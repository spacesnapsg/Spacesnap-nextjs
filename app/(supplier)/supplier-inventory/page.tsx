"use client";

import { useState } from "react";
import { Plus, MapPin, Image as ImageIcon, Zap } from "lucide-react";
import Button from "@/components/Button";
import AddEditListingModal from "@/components/AddEditListingModal";
import { useSupplierListings, useToggleAvailability } from "@/lib/hooks/useSupplierListings";
import { useSupplierCompany, useActivateBump } from "@/lib/hooks/useSupplierCompany";
import type { Listing, ListingType } from "@/lib/hooks/useListings";

const TYPE_BADGE_STYLES: Record<ListingType, string> = {
  space: "bg-body-text/10 text-body-text border-body-text/20",
  equipment: "bg-supplier-purple-start/15 text-supplier-purple-end border-supplier-purple-start/30",
  consumables: "bg-amber/15 text-amber border-amber/30",
};

type TypeFilter = "all" | ListingType;

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "space", label: "Spaces" },
  { key: "equipment", label: "Equipment" },
  { key: "consumables", label: "Consumables" },
];

function ListingCard({
  listing,
  onEdit,
  onToggleAvailability,
  isToggling,
  onBump,
  isBumping,
  bumpsAvailable,
}: {
  listing: Listing;
  onEdit: (listing: Listing) => void;
  onToggleAvailability: (id: string) => void;
  isToggling: boolean;
  onBump: (id: string) => void;
  isBumping: boolean;
  bumpsAvailable: number;
}) {
  const isConsumable = listing.type === "consumables";

  return (
    <div className="bg-card border border-border/10 rounded-card overflow-hidden flex flex-col">
      <div className="relative h-40 bg-background flex items-center justify-center">
        <ImageIcon size={28} className="text-muted-text" />
        <span
          className={`absolute top-3 right-3 rounded-full border px-2.5 py-1 text-xs font-medium ${
            listing.isAvailable
              ? "bg-success-green/15 text-success-green border-success-green/30"
              : "bg-error-red/15 text-error-red border-error-red/30"
          }`}
        >
          {listing.isAvailable ? "Available" : "Unavailable"}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-body-text leading-snug line-clamp-2">{listing.name}</h3>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${TYPE_BADGE_STYLES[listing.type]}`}
          >
            {listing.type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-text min-w-0">
          <MapPin size={14} className="shrink-0" />
          <span className="truncate">{listing.location}</span>
        </div>

        {isConsumable ? (
          <div className="grid grid-cols-2 gap-2 text-sm border-t border-border/40 pt-3 mt-1">
            <div>
              <p className="text-muted-text text-xs">Per unit</p>
              <p className="text-body-text font-medium">{listing.pricePerUnit} credits</p>
            </div>
            <div>
              <p className="text-muted-text text-xs">Stock</p>
              <p className="text-body-text font-medium">{listing.stockQuantity}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-sm border-t border-border/40 pt-3 mt-1">
            <div>
              <p className="text-muted-text text-xs">Day</p>
              <p className="text-body-text font-medium">{listing.priceDay} credits</p>
            </div>
            <div>
              <p className="text-muted-text text-xs">Week</p>
              <p className="text-body-text font-medium">{listing.priceWeek} credits</p>
            </div>
            <div>
              <p className="text-muted-text text-xs">Month</p>
              <p className="text-body-text font-medium">{listing.priceMonth} credits</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <Button variant="ghost" onClick={() => onEdit(listing)} className="flex-1 h-9">
            Edit
          </Button>
          <button
            type="button"
            disabled={isToggling}
            onClick={() => onToggleAvailability(listing.id)}
            className={`flex-1 h-9 rounded text-sm font-medium border transition-colors ${
              isToggling ? "opacity-50 cursor-not-allowed" : ""
            } ${
              listing.isAvailable
                ? "bg-error-red/15 text-error-red border-error-red/30 hover:bg-error-red/25"
                : "bg-supplier-purple-start/15 text-supplier-purple-end border-supplier-purple-start/30 hover:bg-supplier-purple-start/25"
            }`}
          >
            {listing.isAvailable ? "Mark Unavailable" : "Mark Available"}
          </button>
        </div>
        <button
          type="button"
          disabled={isBumping || bumpsAvailable <= 0}
          onClick={() => onBump(listing.id)}
          title={bumpsAvailable <= 0 ? "No Bumps available — buy more from the Supplier Profile catalogue." : "Bump to the front of the marketplace"}
          className={`flex items-center justify-center gap-1.5 h-9 rounded text-sm font-medium border transition-colors ${
            isBumping || bumpsAvailable <= 0
              ? "opacity-50 cursor-not-allowed border-border text-muted-text"
              : "bg-amber/15 text-amber border-amber/30 hover:bg-amber/25"
          }`}
        >
          <Zap size={14} />
          {isBumping ? "Bumping…" : `Bump (${bumpsAvailable} left)`}
        </button>
      </div>
    </div>
  );
}

export default function SupplierInventoryPage() {
  const { data: listings, isLoading, isError } = useSupplierListings();
  const toggleAvailability = useToggleAvailability();
  const { data: company } = useSupplierCompany();
  const activateBump = useActivateBump();
  const bumpsAvailable = company?.bumpsAvailable ?? 0;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filteredListings = (listings ?? []).filter(
    (listing) => typeFilter === "all" || listing.type === typeFilter
  );

  function openAddModal() {
    setEditingListing(null);
    setModalOpen(true);
  }

  function openEditModal(listing: Listing) {
    setEditingListing(listing);
    setModalOpen(true);
  }

  if (isLoading) {
    return <p className="text-sm text-muted-text text-center py-16">Loading inventory…</p>;
  }

  if (isError) {
    return <p className="text-sm text-error-red text-center py-16">Failed to load inventory.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end bg-clip-text text-transparent">
            Inventory Management
          </h1>
          <p className="text-muted-text mt-1">Manage your listings and availability</p>
          <p className="flex items-center gap-1.5 text-sm text-amber mt-2">
            <Zap size={16} /> {bumpsAvailable} Bump{bumpsAvailable === 1 ? "" : "s"} left
          </p>
        </div>
        <Button
          onClick={openAddModal}
          className="!bg-gradient-to-r !from-supplier-purple-start !to-supplier-purple-end gap-1.5 self-start"
        >
          <Plus size={18} />
          Add New Listing
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        {TYPE_FILTERS.map((filter) => {
          const isActive = typeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setTypeFilter(filter.key)}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-supplier-purple-start/20 border-supplier-purple-start text-supplier-purple-end"
                  : "bg-card border-border text-muted-text hover:text-body-text"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filteredListings.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-16">No listings match the selected filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onEdit={openEditModal}
              onToggleAvailability={(id) => toggleAvailability.mutate(id)}
              isToggling={toggleAvailability.isPending && toggleAvailability.variables === listing.id}
              onBump={(id) => activateBump.mutate(id)}
              isBumping={activateBump.isPending && activateBump.variables === listing.id}
              bumpsAvailable={bumpsAvailable}
            />
          ))}
        </div>
      )}

      <AddEditListingModal
        key={editingListing ? editingListing.id : "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={editingListing ? "edit" : "add"}
        listing={editingListing ?? undefined}
      />
    </div>
  );
}
