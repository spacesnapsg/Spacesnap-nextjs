"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  MapPin,
  Package,
  Search,
  X,
} from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import BookingModal from "@/components/BookingModal";
import RequestPurchaseModal from "@/components/RequestPurchaseModal";
import { MOCK_LISTINGS, type Listing, type ListingType } from "@/lib/mockListings";
import { getCompanyName } from "@/lib/mockCompanies";
import { MOCK_CERTIFICATES, MOCK_USER_CERTIFICATES } from "@/lib/mockPassport";

type TypeFilter = "all" | ListingType;
type ViewMode = "grid" | "map";

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

const EARNED_CERT_IDS = new Set(MOCK_USER_CERTIFICATES.map((uc) => uc.certificate_id));

function isOutOfStock(listing: Listing) {
  return listing.type === "consumable" && listing.stock_quantity <= 0;
}

function getMissingCertNames(listing: Listing) {
  return listing.required_certificate_ids
    .filter((id) => !EARNED_CERT_IDS.has(id))
    .map((id) => MOCK_CERTIFICATES.find((cert) => cert.id === id)?.name)
    .filter((name): name is string => !!name);
}

interface ListingDetails {
  isUnavailable: boolean;
  isConsumable: boolean;
  isOutOfStockItem: boolean;
  missingCertNames: string[];
  isCertMissing: boolean;
}

function getListingDetails(listing: Listing): ListingDetails {
  const isConsumable = listing.type === "consumable";
  const isOutOfStockItem = isOutOfStock(listing);
  const missingCertNames = getMissingCertNames(listing);

  return {
    isUnavailable: !listing.is_available,
    isConsumable,
    isOutOfStockItem,
    missingCertNames,
    isCertMissing: missingCertNames.length > 0,
  };
}

function ListingBody({
  listing,
  details,
  onBookNow,
  onRequestPurchase,
}: {
  listing: Listing;
  details: ListingDetails;
  onBookNow: (listing: Listing) => void;
  onRequestPurchase: (listing: Listing) => void;
}) {
  const { isUnavailable, isConsumable, isOutOfStockItem, missingCertNames, isCertMissing } = details;

  return (
    <div className="p-5 flex flex-col gap-3 flex-1">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-body-text leading-snug line-clamp-2">{listing.name}</h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${TYPE_BADGE_STYLES[listing.type]}`}
        >
          {listing.type}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-text min-w-0">
        <Building2 size={13} className="shrink-0" />
        <span className="truncate">{getCompanyName(listing.company_id)}</span>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-text min-w-0">
        <MapPin size={14} className="shrink-0" />
        <span className="truncate">{listing.location}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {listing.amenities.map((amenity) => (
          <span
            key={amenity}
            className="bg-background border border-border/60 text-muted-text rounded-full px-2.5 py-1 text-xs"
          >
            {amenity}
          </span>
        ))}
      </div>

      {missingCertNames.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 w-fit bg-amber/10 text-amber border border-amber/30 rounded-full px-2.5 py-1 text-xs font-medium">
          <Lock size={12} />
          Requires: {missingCertNames.join(", ")}
        </span>
      ) : (
        listing.type === "consumable" && (
          <span className="inline-flex items-center gap-1.5 w-fit bg-background text-muted-text border border-border/60 rounded-full px-2.5 py-1 text-xs font-medium">
            <Package size={12} />
            Pack Size: {listing.pack_size}
          </span>
        )
      )}

      {listing.type === "consumable" ? (
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
        disabled={isUnavailable || isCertMissing}
        onClick={() => (isOutOfStockItem ? onRequestPurchase(listing) : onBookNow(listing))}
        className={`w-full mt-1 ${
          isUnavailable
            ? "opacity-50 cursor-not-allowed"
            : isCertMissing
              ? "!bg-none bg-card border border-amber/40 !text-amber cursor-not-allowed"
              : ""
        }`}
      >
        {isCertMissing
          ? "Cert Required"
          : isOutOfStockItem
            ? "Request Purchase"
            : isConsumable
              ? "Buy Now"
              : "Book Now"}
      </Button>
    </div>
  );
}

function ListingCard({
  listing,
  onBookNow,
  onRequestPurchase,
}: {
  listing: Listing;
  onBookNow: (listing: Listing) => void;
  onRequestPurchase: (listing: Listing) => void;
}) {
  const details = getListingDetails(listing);

  return (
    <div className="bg-card border border-border/10 rounded-card overflow-hidden flex flex-col">
      <div className="relative h-48 bg-background flex items-center justify-center">
        <ImageIcon size={32} className="text-muted-text" />

        {details.isOutOfStockItem ? (
          <span className="absolute top-3 left-3 flex items-center gap-1 bg-error-red/15 text-error-red border border-error-red/30 rounded-full px-2.5 py-1 text-xs font-medium">
            Out of Stock
          </span>
        ) : (
          listing.is_available && (
            <span className="absolute top-3 left-3 flex items-center gap-1 bg-success-green/15 text-success-green border border-success-green/30 rounded-full px-2.5 py-1 text-xs font-medium">
              <CheckCircle2 size={12} />
              Available Now
            </span>
          )
        )}

        {details.isUnavailable && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center">
            <span className="text-body-text font-semibold text-sm">Unavailable</span>
          </div>
        )}
      </div>

      <ListingBody
        listing={listing}
        details={details}
        onBookNow={onBookNow}
        onRequestPurchase={onRequestPurchase}
      />
    </div>
  );
}

const MAP_PIN_POSITIONS = [
  { top: "28%", left: "22%" },
  { top: "55%", left: "48%" },
  { top: "38%", left: "72%" },
  { top: "70%", left: "20%" },
  { top: "20%", left: "58%" },
  { top: "68%", left: "80%" },
];

function MapView({
  listings,
  onBookNow,
  onRequestPurchase,
}: {
  listings: Listing[];
  onBookNow: (listing: Listing) => void;
  onRequestPurchase: (listing: Listing) => void;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeListing = listings.find((listing) => listing.id === activeId) ?? null;
  const activeDetails = activeListing ? getListingDetails(activeListing) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 relative h-[420px] rounded-card overflow-hidden border border-border/40 bg-background">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(31,41,55,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(31,41,55,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <span className="absolute top-3 left-3 bg-card/90 text-muted-text text-xs px-2.5 py-1 rounded-full border border-border/60">
          Sample map preview
        </span>

        {listings.map((listing, index) => {
          const pos = MAP_PIN_POSITIONS[index % MAP_PIN_POSITIONS.length];
          const isActive = listing.id === activeId;
          return (
            <button
              key={listing.id}
              type="button"
              onClick={() => setActiveId(listing.id)}
              style={{ top: pos.top, left: pos.left }}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group"
            >
              <span
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors ${
                  isActive
                    ? "bg-user-teal-start text-white border-user-teal-start"
                    : "bg-card text-body-text border-border/60 group-hover:border-user-teal-start/50"
                }`}
              >
                <MapPin size={12} />
                {listing.type === "consumable"
                  ? `${listing.price_per_unit} cr/${listing.unit_label}`
                  : `${listing.price_day} cr/day`}
              </span>
              <span
                className={`h-2 w-2 rotate-45 -mt-1 ${
                  isActive ? "bg-user-teal-start" : "bg-card border-r border-b border-border/60"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-border/10 rounded-card p-5">
        {activeListing && activeDetails ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-body-text leading-snug line-clamp-2">{activeListing.name}</h3>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${TYPE_BADGE_STYLES[activeListing.type]}`}
              >
                {activeListing.type}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-text min-w-0">
              <Building2 size={13} className="shrink-0" />
              <span className="truncate">{getCompanyName(activeListing.company_id)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-text min-w-0">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{activeListing.location}</span>
            </div>
            {activeListing.type === "consumable" ? (
              <div className="border-t border-border/40 pt-3">
                <p className="text-muted-text text-xs">Price</p>
                <p className="text-body-text font-medium">
                  {activeListing.price_per_unit} cr / {activeListing.unit_label}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-sm border-t border-border/40 pt-3">
                <div>
                  <p className="text-muted-text text-xs">Day</p>
                  <p className="text-body-text font-medium">{activeListing.price_day} cr</p>
                </div>
                <div>
                  <p className="text-muted-text text-xs">Week</p>
                  <p className="text-body-text font-medium">{activeListing.price_week} cr</p>
                </div>
                <div>
                  <p className="text-muted-text text-xs">Month</p>
                  <p className="text-body-text font-medium">{activeListing.price_month} cr</p>
                </div>
              </div>
            )}
            <Button
              disabled={activeDetails.isUnavailable || activeDetails.isCertMissing}
              onClick={() =>
                activeDetails.isOutOfStockItem ? onRequestPurchase(activeListing) : onBookNow(activeListing)
              }
              className={`w-full mt-1 ${
                activeDetails.isUnavailable || activeDetails.isCertMissing
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {activeDetails.isCertMissing
                ? "Cert Required"
                : activeDetails.isOutOfStockItem
                  ? "Request Purchase"
                  : activeListing.type === "consumable"
                    ? "Buy Now"
                    : "Book Now"}
            </Button>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
            <MapIcon size={28} className="text-muted-text" />
            <p className="text-sm text-muted-text">Select a pin to preview a listing</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [showStatusStrip, setShowStatusStrip] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [bookingListing, setBookingListing] = useState<Listing | null>(null);
  const [requestListing, setRequestListing] = useState<Listing | null>(null);

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
    <>
      {showStatusStrip && (
        <div className="w-full bg-card border-b border-border/40 px-4 md:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-amber shrink-0" />
            <span className="text-body-text">Your BSL-2 Safety cert expires in 3 days</span>
          </div>
          <button
            onClick={() => setShowStatusStrip(false)}
            className="text-muted-text hover:text-body-text transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-user-teal-start to-user-teal-end bg-clip-text text-transparent">
              Global Marketplace
            </h1>
            <p className="text-muted-text mt-1">Discover spaces, equipment, and consumables worldwide</p>
          </div>

          <div className="flex items-center gap-1 bg-card border border-border rounded p-1 self-start">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "grid" ? "bg-user-teal-start text-white" : "text-muted-text hover:text-body-text"
              }`}
            >
              <LayoutGrid size={16} />
              Grid view
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "map" ? "bg-user-teal-start text-white" : "text-muted-text hover:text-body-text"
              }`}
            >
              <MapIcon size={16} />
              Map view
            </button>
          </div>
        </div>

        <div className="relative mb-5">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none"
          />
          <Input
            type="text"
            placeholder="Search locations, equipment, or spaces..."
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
          <p className="text-sm text-muted-text text-center py-16">No listings match the selected filters.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onBookNow={setBookingListing}
                onRequestPurchase={setRequestListing}
              />
            ))}
          </div>
        ) : (
          <MapView
            listings={filteredListings}
            onBookNow={setBookingListing}
            onRequestPurchase={setRequestListing}
          />
        )}
      </div>

      <BookingModal
        key={bookingListing?.id ?? "none"}
        open={bookingListing !== null}
        onClose={() => setBookingListing(null)}
        listing={bookingListing}
      />

      <RequestPurchaseModal
        key={requestListing?.id ?? "none-request"}
        open={requestListing !== null}
        onClose={() => setRequestListing(null)}
        listing={requestListing}
      />
    </>
  );
}
