"use client";

import { useState } from "react";
import { Zap, Pin as PinIcon, FileText, Megaphone, Mail } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { useSupplierCompany, usePurchaseBumps, usePurchasePin, BUMP_UNIT_COST_CREDITS_DISPLAY } from "@/lib/hooks/useSupplierCompany";
import { useSupplierListings, PIN_DURATION_COST_CREDITS_DISPLAY } from "@/lib/hooks/useSupplierListings";
import { ApiRequestError } from "@/lib/api-client";

// Sprint 6.12 — the listing-boost catalogue on Supplier Profile. Bumps and
// Pin are real, wired to the Phase 6/7 purchase routes; Lab Digest, Ads,
// and Newsletter space stay static placeholders ("Content/format TBD" per
// the product owner's own framing) — confirmed this session as no-further-
// design-this-pass, not an oversight.
function BumpsCard() {
  const { data: company } = useSupplierCompany();
  const purchase = usePurchaseBumps();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function handleBuy() {
    setError(null);
    purchase.mutate(quantity, {
      onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Purchase failed."),
    });
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Zap size={18} className="text-amber" />
        <h4 className="text-sm font-semibold text-body-text">Bumps</h4>
      </div>
      <p className="text-xs text-muted-text mb-3">
        Move a listing to the front of the marketplace, as if newly posted. {BUMP_UNIT_COST_CREDITS_DISPLAY} credits each.
        You have <span className="font-semibold text-body-text">{company?.bumpsAvailable ?? 0}</span> available.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          className="w-20 bg-background border border-border/40 text-body-text rounded h-9 px-3 focus:outline-none focus:border-supplier-purple-start transition-colors"
        />
        <Button onClick={handleBuy} disabled={purchase.isPending} className="h-9 !px-4 text-sm">
          {purchase.isPending ? "Buying…" : `Buy (${quantity * BUMP_UNIT_COST_CREDITS_DISPLAY} credits)`}
        </Button>
      </div>
      {error && <p className="text-xs text-error-red mt-2">{error}</p>}
    </Card>
  );
}

function PinCard() {
  const { data: listings } = useSupplierListings();
  const purchase = usePurchasePin();
  const [picker, setPicker] = useState<7 | 30 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeListings = (listings ?? []).filter((l) => l.isAvailable);

  function handlePin(listingId: string) {
    if (!picker) return;
    setError(null);
    purchase.mutate(
      { listingId, durationDays: picker },
      {
        onSuccess: () => setPicker(null),
        onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Purchase failed."),
      }
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <PinIcon size={18} className="text-amber" />
        <h4 className="text-sm font-semibold text-body-text">Pin</h4>
      </div>
      <p className="text-xs text-muted-text mb-3">Pin a listing to the very top of marketplace results for a set duration.</p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setPicker(7)} className="h-9 !px-4 text-sm flex-1">
          7 days ({PIN_DURATION_COST_CREDITS_DISPLAY[7]} credits)
        </Button>
        <Button variant="ghost" onClick={() => setPicker(30)} className="h-9 !px-4 text-sm flex-1">
          30 days ({PIN_DURATION_COST_CREDITS_DISPLAY[30]} credits)
        </Button>
      </div>

      <Modal open={picker !== null} onClose={() => setPicker(null)} className="max-w-md">
        <h3 className="text-base font-semibold text-body-text mb-3">Choose a listing to pin ({picker} days)</h3>
        {activeListings.length === 0 ? (
          <p className="text-sm text-muted-text">No active listings to pin.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {activeListings.map((listing) => (
              <li key={listing.id}>
                <button
                  type="button"
                  disabled={purchase.isPending}
                  onClick={() => handlePin(listing.id)}
                  className="w-full text-left px-3 py-2 rounded border border-border/40 hover:border-supplier-purple-start text-sm text-body-text transition-colors disabled:opacity-50"
                >
                  {listing.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-xs text-error-red mt-3">{error}</p>}
      </Modal>
    </Card>
  );
}

function PlaceholderCard({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return (
    <Card className="opacity-70">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className="text-muted-text" />
        <h4 className="text-sm font-semibold text-body-text">{title}</h4>
      </div>
      <p className="text-xs text-muted-text">{description}</p>
      <span className="inline-block mt-2 text-xs font-medium text-muted-text bg-background border border-border/40 rounded-full px-2.5 py-1">
        Coming soon
      </span>
    </Card>
  );
}

export default function ListingBoostCatalogueCard() {
  return (
    <div>
      <h3 className="text-base font-semibold text-body-text mb-3">Boost Your Listings</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BumpsCard />
        <PinCard />
        <PlaceholderCard
          icon={FileText}
          title="Lab Digest"
          description="A purchasable report on who's new on SpaceSnap, buying trends, and more. Content/format TBD."
        />
        <PlaceholderCard
          icon={Megaphone}
          title="Ads"
          description="Buy a popup ad slot shown to Members on sign-in, via the EDM popup mechanism above."
        />
        <PlaceholderCard
          icon={Mail}
          title="Newsletter"
          description="Purchasable placement in a newsletter. Content TBD."
        />
      </div>
    </div>
  );
}
