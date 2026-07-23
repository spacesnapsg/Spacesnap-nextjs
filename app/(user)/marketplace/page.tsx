"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  MapPin,
  Package,
  Pin as PinIcon,
  Search,
  Wrench,
  X,
} from "lucide-react";
import Button from "@/components/Button";
import Input from "@/components/Input";
import BookingModal from "@/components/BookingModal";
import RequestPurchaseModal from "@/components/RequestPurchaseModal";
import RatingDisplay from "@/components/RatingDisplay";
import CustomRequirementsModal from "@/components/CustomRequirementsModal";
import { useListings, type Listing, type ListingType } from "@/lib/hooks/useListings";
import { useCredentials, isCredentialHeld, type Credential } from "@/lib/hooks/useCredentials";

type TypeFilter = "all" | ListingType;
type ViewMode = "grid" | "map";

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "space", label: "Spaces" },
  { key: "equipment", label: "Equipment" },
  { key: "consumables", label: "Consumables" },
];

const TYPE_BADGE_STYLES: Record<ListingType, string> = {
  space: "bg-user-teal-start/15 text-user-teal-end border-user-teal-start/30",
  equipment: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  consumables: "bg-amber/15 text-amber border-amber/30",
};

function isOutOfStock(listing: Listing) {
  return listing.type === "consumables" && (listing.stockQuantity ?? 0) <= 0;
}

interface RequiredCertStatus {
  id: string;
  name: string;
  held: boolean;
}

function getRequiredCertStatuses(listing: Listing, credentials: Credential[] | undefined): RequiredCertStatus[] {
  return (listing.requiredCertificates ?? []).map((cert) => ({
    id: cert.id,
    name: cert.name,
    held: isCredentialHeld(credentials, cert.id),
  }));
}

interface ListingDetails {
  isUnavailable: boolean;
  isConsumable: boolean;
  isOutOfStockItem: boolean;
  requiredCertStatuses: RequiredCertStatus[];
  isCertMissing: boolean;
}

function getListingDetails(listing: Listing, credentials: Credential[] | undefined): ListingDetails {
  const isConsumable = listing.type === "consumables";
  const isOutOfStockItem = isOutOfStock(listing);
  const requiredCertStatuses = getRequiredCertStatuses(listing, credentials);

  return {
    isUnavailable: !listing.isAvailable,
    isConsumable,
    isOutOfStockItem,
    requiredCertStatuses,
    isCertMissing: requiredCertStatuses.some((cert) => !cert.held),
  };
}

type RequestPurchaseHandler = (listing: Listing, mode: "quick" | "bulk") => void;

function ListingActions({
  listing,
  details,
  onBookNow,
  onRequestPurchase,
}: {
  listing: Listing;
  details: ListingDetails;
  onBookNow: (listing: Listing) => void;
  onRequestPurchase: RequestPurchaseHandler;
}) {
  const { isUnavailable, isConsumable, isOutOfStockItem, isCertMissing } = details;

  if (isCertMissing) {
    return (
      <Button
        disabled
        className="w-full mt-1 !bg-none bg-card border border-amber/40 !text-amber cursor-not-allowed"
      >
        Cert Required
      </Button>
    );
  }

  if (isUnavailable) {
    return (
      <Button disabled className="w-full mt-1 opacity-50 cursor-not-allowed">
        {!isConsumable ? "Book Now" : isOutOfStockItem ? "Request Purchase" : "Buy Now"}
      </Button>
    );
  }

  if (!isConsumable) {
    return (
      <Button className="w-full mt-1" onClick={() => onBookNow(listing)}>
        Book Now
      </Button>
    );
  }

  if (isOutOfStockItem) {
    return (
      <Button className="w-full mt-1" onClick={() => onRequestPurchase(listing, "bulk")}>
        Request Purchase
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      <Button className="w-full" onClick={() => onRequestPurchase(listing, "quick")}>
        Buy Now
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => onRequestPurchase(listing, "bulk")}
      >
        Request Bulk Purchase
      </Button>
    </div>
  );
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
  onRequestPurchase: RequestPurchaseHandler;
}) {
  const { requiredCertStatuses } = details;
  const router = useRouter();

  return (
    <div className="p-5 flex flex-col gap-3 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-body-text leading-snug line-clamp-2">{listing.name}</h3>
          {listing.type !== "consumables" && listing.ratingCount > 0 && (
            <div className="mt-1">
              <RatingDisplay average={listing.averageRating ?? 0} count={listing.ratingCount} />
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${TYPE_BADGE_STYLES[listing.type]}`}
        >
          {listing.type}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-text min-w-0">
        <Building2 size={13} className="shrink-0" />
        <span className="truncate">{listing.companyName ?? "Unknown supplier"}</span>
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

      {requiredCertStatuses.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {requiredCertStatuses.map((cert) =>
            cert.held ? (
              <span
                key={cert.id}
                className="inline-flex items-center gap-1.5 w-fit bg-success-green/10 text-success-green border border-success-green/30 rounded-full px-2.5 py-1 text-xs font-medium"
              >
                <Check size={12} />
                {cert.name}
              </span>
            ) : (
              <button
                key={cert.id}
                type="button"
                onClick={() => router.push(`/passport?certId=${cert.id}`)}
                className="inline-flex items-center gap-1.5 w-fit bg-amber/10 text-amber border border-amber/30 rounded-full px-2.5 py-1 text-xs font-medium hover:bg-amber/20 transition-colors"
                title="View required training in your Digital Passport"
              >
                <Lock size={12} />
                {cert.name}
              </button>
            )
          )}
        </div>
      ) : (
        listing.type === "consumables" && (
          <span className="inline-flex items-center gap-1.5 w-fit bg-background text-muted-text border border-border/60 rounded-full px-2.5 py-1 text-xs font-medium">
            <Package size={12} />
            Pack Size: {listing.packSize}
          </span>
        )
      )}

      {listing.type === "consumables" ? (
        <div className="border-t border-border/40 pt-3 mt-1">
          <p className="text-muted-text text-xs">Price</p>
          <p className="text-body-text font-medium">{listing.pricePerUnit} credits / unit</p>
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

      <div className="flex-1" />

      <ListingActions
        listing={listing}
        details={details}
        onBookNow={onBookNow}
        onRequestPurchase={onRequestPurchase}
      />
    </div>
  );
}

function ListingCard({
  listing,
  credentials,
  onBookNow,
  onRequestPurchase,
}: {
  listing: Listing;
  credentials: Credential[] | undefined;
  onBookNow: (listing: Listing) => void;
  onRequestPurchase: RequestPurchaseHandler;
}) {
  const details = getListingDetails(listing, credentials);

  return (
    <div className="bg-card border border-border/10 rounded-card overflow-hidden flex flex-col">
      <div className="relative h-48 bg-background flex items-center justify-center">
        <ImageIcon size={32} className="text-muted-text" />

        {listing.isPinned && (
          <span className="absolute top-3 right-3 flex items-center gap-1 bg-amber/90 text-white rounded-full px-2.5 py-1 text-xs font-medium shadow">
            <PinIcon size={12} />
            Pinned
          </span>
        )}

        {details.isOutOfStockItem ? (
          <span className="absolute top-3 left-3 flex items-center gap-1 bg-error-red/15 text-error-red border border-error-red/30 rounded-full px-2.5 py-1 text-xs font-medium">
            Out of Stock
          </span>
        ) : (
          listing.isAvailable && (
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
  credentials,
  onBookNow,
  onRequestPurchase,
}: {
  listings: Listing[];
  credentials: Credential[] | undefined;
  onBookNow: (listing: Listing) => void;
  onRequestPurchase: RequestPurchaseHandler;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeListing = listings.find((listing) => listing.id === activeId) ?? null;
  const activeDetails = activeListing ? getListingDetails(activeListing, credentials) : null;

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
                  listing.isPinned
                    ? "bg-amber text-white border-amber"
                    : isActive
                      ? "bg-user-teal-start text-white border-user-teal-start"
                      : "bg-card text-body-text border-border/60 group-hover:border-user-teal-start/50"
                }`}
              >
                {listing.isPinned ? <PinIcon size={12} /> : <MapPin size={12} />}
                {listing.type === "consumables"
                  ? `${listing.pricePerUnit} credits/unit`
                  : `${listing.priceDay} credits/day`}
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
            {activeListing.type !== "consumables" && activeListing.ratingCount > 0 && (
              <RatingDisplay average={activeListing.averageRating ?? 0} count={activeListing.ratingCount} />
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-text min-w-0">
              <Building2 size={13} className="shrink-0" />
              <span className="truncate">{activeListing.companyName ?? "Unknown supplier"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-text min-w-0">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{activeListing.location}</span>
            </div>
            {activeListing.type === "consumables" ? (
              <div className="border-t border-border/40 pt-3">
                <p className="text-muted-text text-xs">Price</p>
                <p className="text-body-text font-medium">{activeListing.pricePerUnit} credits / unit</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-sm border-t border-border/40 pt-3">
                <div>
                  <p className="text-muted-text text-xs">Day</p>
                  <p className="text-body-text font-medium">{activeListing.priceDay} credits</p>
                </div>
                <div>
                  <p className="text-muted-text text-xs">Week</p>
                  <p className="text-body-text font-medium">{activeListing.priceWeek} credits</p>
                </div>
                <div>
                  <p className="text-muted-text text-xs">Month</p>
                  <p className="text-body-text font-medium">{activeListing.priceMonth} credits</p>
                </div>
              </div>
            )}
            <ListingActions
              listing={activeListing}
              details={activeDetails}
              onBookNow={onBookNow}
              onRequestPurchase={onRequestPurchase}
            />
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

function CustomRequirementsSection({
  onMembershipInquiry,
  onConsultationRequest,
}: {
  onMembershipInquiry: () => void;
  onConsultationRequest: () => void;
}) {
  return (
    <div className="mt-12">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-body-text">Can&apos;t Find What You Need?</h2>
        <p className="text-muted-text mt-1">We offer specialized services for custom requirements</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border/10 rounded-card p-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-user-teal-start to-user-teal-end flex items-center justify-center mb-4">
            <Building2 size={22} className="text-white" />
          </div>
          <h3 className="font-semibold text-body-text mb-2">Dedicated Space Membership</h3>
          <p className="text-sm text-muted-text mb-5">
            Need dedicated, long-term access (1+ years)? We connect you with verified space partners offering
            membership plans for ongoing access to labs, kitchens, and workspaces tailored to your needs.
          </p>
          <Button onClick={onMembershipInquiry} className="w-full">
            Submit Membership Inquiry
          </Button>
        </div>

        <div className="bg-card border border-border/10 rounded-card p-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-supplier-purple-start to-supplier-purple-end flex items-center justify-center mb-4">
            <Wrench size={22} className="text-white" />
          </div>
          <h3 className="font-semibold text-body-text mb-2">Infrastructure Consultancy</h3>
          <p className="text-sm text-muted-text mb-5">
            Got a need that doesn&apos;t fit a listing? Renovations, space planning, equipment sourcing,
            consumables, logistics — whatever it is, our expert consultants and partners work with you to
            sort it out.
          </p>
          <Button
            variant="ghost"
            onClick={onConsultationRequest}
            className="w-full !border-0 !text-white bg-gradient-to-r from-supplier-purple-start to-supplier-purple-end"
          >
            Request Consultation
          </Button>
        </div>
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
  const [requestMode, setRequestMode] = useState<"quick" | "bulk">("bulk");
  const [requirementsModal, setRequirementsModal] = useState<"membership" | "consultancy" | null>(null);

  function handleRequestPurchase(listing: Listing, mode: "quick" | "bulk") {
    setRequestListing(listing);
    setRequestMode(mode);
  }

  const { data: listings, isLoading, isError } = useListings();
  const { data: credentials } = useCredentials();

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (listings ?? []).filter((listing) => {
      const matchesType = typeFilter === "all" || listing.type === typeFilter;
      const matchesQuery =
        query === "" ||
        listing.name.toLowerCase().includes(query) ||
        (listing.location ?? "").toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [listings, typeFilter, search]);

  // Sprint 6.12 — Pins render as their own structurally separate row, not
  // just the first cards in the regular grid, per the product owner's own
  // clarification: a Bump must never visually compete with or appear to
  // unseat a Pin. The API's own order already puts pinned rows first
  // (pinnedAt desc, then boostedAt desc), so this split preserves it in
  // each group rather than re-sorting.
  const pinnedListings = useMemo(() => filteredListings.filter((l) => l.isPinned), [filteredListings]);
  const regularListings = useMemo(() => filteredListings.filter((l) => !l.isPinned), [filteredListings]);

  if (isLoading) {
    return <p className="text-sm text-muted-text text-center py-16">Loading listings…</p>;
  }

  if (isError) {
    return <p className="text-sm text-error-red text-center py-16">Failed to load listings.</p>;
  }

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

        </div>

        {filteredListings.length === 0 ? (
          <p className="text-sm text-muted-text text-center py-16">No listings match the selected filters.</p>
        ) : viewMode === "grid" ? (
          <>
            {pinnedListings.length > 0 && (
              <div className="mb-8">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber mb-3">
                  <PinIcon size={16} />
                  Pinned
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pinnedListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      credentials={credentials}
                      onBookNow={setBookingListing}
                      onRequestPurchase={handleRequestPurchase}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  credentials={credentials}
                  onBookNow={setBookingListing}
                  onRequestPurchase={handleRequestPurchase}
                />
              ))}
            </div>
          </>
        ) : (
          <MapView
            listings={filteredListings}
            credentials={credentials}
            onBookNow={setBookingListing}
            onRequestPurchase={handleRequestPurchase}
          />
        )}

        <CustomRequirementsSection
          onMembershipInquiry={() => setRequirementsModal("membership")}
          onConsultationRequest={() => setRequirementsModal("consultancy")}
        />
      </div>

      <CustomRequirementsModal
        open={requirementsModal !== null}
        onClose={() => setRequirementsModal(null)}
        type={requirementsModal ?? "membership"}
      />

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
        mode={requestMode}
      />
    </>
  );
}
