"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Image as ImageIcon, MapPin, Search } from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import BookingModal from "@/components/BookingModal";
import { MOCK_LISTINGS, type Listing, type ListingType } from "@/lib/mockListings";

type TypeFilter = "all" | ListingType;

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "space", label: "Spaces" },
  { key: "equipment", label: "Equipment" },
  { key: "consumable", label: "Consumables" },
];

const TYPE_BADGE_STYLES: Record<ListingType, string> = {
  space: "bg-user-teal-start/15 text-user-teal-end border-user-teal-start/30",
  equipment: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  consumable: "bg-amber/15 text-amber border-amber/30",
};

function ListingCard({
  listing,
  onBookNow,
}: {
  listing: Listing;
  onBookNow: (listing: Listing) => void;
}) {
  const isConsumable = listing.type === "consumable";

  return (
    <div className="bg-card border border-border/10 rounded-card overflow-hidden flex flex-col">
      <div className="relative h-48 bg-background flex items-center justify-center">
        <ImageIcon size={32} className="text-muted-text" />

        {listing.is_available && (
          <span className="absolute top-3 left-3 flex items-center gap-1 bg-user-teal-start/15 text-user-teal-end border border-user-teal-start/30 rounded-full px-2.5 py-1 text-xs font-medium">
            <CheckCircle2 size={12} />
            Available Now
          </span>
        )}

        {!listing.is_available && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center">
            <span className="text-red-400 font-semibold text-sm">Unavailable</span>
          </div>
        )}
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
          <div className="border-t border-border/40 pt-3 mt-1">
            <p className="text-muted-text text-xs">Price</p>
            <p className="text-body-text font-medium">
              {listing.price_per_unit} cr / {listing.unit_label}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-sm border-t border-border/40 pt-3 mt-1">
            <div>
              <p className="text-muted-text text-xs">Day</p>
              <p className="text-body-text font-medium">{listing.price_day} cr</p>
            </div>
            <div>
              <p className="text-muted-text text-xs">Week</p>
              <p className="text-body-text font-medium">{listing.price_week} cr</p>
            </div>
            <div>
              <p className="text-muted-text text-xs">Month</p>
              <p className="text-body-text font-medium">{listing.price_month} cr</p>
            </div>
          </div>
        )}

        <div className="flex-1" />

        <Button
          disabled={!listing.is_available}
          onClick={() => onBookNow(listing)}
          className={`w-full mt-1 ${!listing.is_available ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isConsumable ? "Buy Now" : "Book Now"}
        </Button>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [bookingListing, setBookingListing] = useState<Listing | null>(null);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return MOCK_LISTINGS.filter((listing) => {
      const matchesType = typeFilter === "all" || listing.type === typeFilter;
      const matchesQuery =
        query === "" ||
        listing.name.toLowerCase().includes(query) ||
        listing.location.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [typeFilter, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-user-teal-start to-user-teal-end bg-clip-text text-transparent">
          Marketplace
        </h1>
        <p className="text-muted-text mt-1">Discover spaces, equipment, and consumables</p>
      </div>

      <div className="relative mb-5">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none"
        />
        <Input
          type="text"
          placeholder="Search by name or location..."
          className="w-full pl-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        {TYPE_FILTERS.map((filter) => {
          const isActive = typeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setTypeFilter(filter.key)}
              className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-user-teal-start/20 border-user-teal-start text-user-teal-end"
                  : "bg-card border-border text-muted-text hover:text-body-text"
              }`}
            >
              {filter.label}
            </button>
          );
        })}

        {typeFilter === "consumable" && (
          <Button variant="ghost" className="ml-auto">
            Bulk Order
          </Button>
        )}
      </div>

      {filteredListings.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-16">No listings match your search.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onBookNow={setBookingListing} />
          ))}
        </div>
      )}

      <BookingModal
        key={bookingListing?.id ?? "none"}
        open={bookingListing !== null}
        onClose={() => setBookingListing(null)}
        listing={bookingListing}
      />
    </div>
  );
}
