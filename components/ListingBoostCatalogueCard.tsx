"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Zap, Pin as PinIcon, FileText, Megaphone, Mail, Star, Tag, type LucideIcon } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { useSupplierCompany, usePurchaseBumps, usePurchasePin } from "@/lib/hooks/useSupplierCompany";
import { useSupplierListings } from "@/lib/hooks/useSupplierListings";
import { useSupplierBoostProducts, usePurchaseBoostProduct, type BoostProduct } from "@/lib/hooks/useBoostProducts";
import { useCreateCompanyBoostRequest } from "@/lib/hooks/useCompanyBoostRequests";
import { ApiRequestError } from "@/lib/api-client";

// Sprint 6.12 — the listing-boost catalogue on Supplier Profile. Fully
// data-driven off BoostProduct (see its own schema comment): however many
// active rows the admin panel (/admin-boost-products) has is however many
// cards render below — no hardcoded slots. builtinEffect "bump"/"pin" keep
// their dedicated purchase mechanics (BumpsCard/PinCard); "none" rows are
// admin-authored custom products (CustomProductCard) — a generic per-unit
// credit purchase with no automated inventory effect.
//
// 2026-07-28 — delegated spend. A member without companyCanPurchaseBoosts
// (see User's own schema comment — ONE flag for the whole catalogue, not
// one per product) doesn't get the direct Buy button here at all; instead
// they get a "request" action that files a CompanyBoostRequest for their
// company admin to approve/decline (supplier-profile's Pending Boost
// Requests section). Every card type reuses the exact same permission check
// and request flow.
function useCanPurchaseBoosts() {
  const { data: session } = useSession();
  return Boolean(session?.user?.isCompanyAdmin || session?.user?.companyCanPurchaseBoosts);
}

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  pin: PinIcon,
  "file-text": FileText,
  megaphone: Megaphone,
  mail: Mail,
  star: Star,
  tag: Tag,
};

function BumpsCard({ product }: { product: BoostProduct }) {
  const canPurchase = useCanPurchaseBoosts();
  const { data: company } = useSupplierCompany();
  const purchase = usePurchaseBumps();
  const requestPurchase = useCreateCompanyBoostRequest();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const unitCost = product.priceCredits ?? 0;

  function handleBuy() {
    setError(null);
    if (canPurchase) {
      purchase.mutate(quantity, {
        onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Purchase failed."),
      });
    } else {
      requestPurchase.mutate(
        { type: "bump", quantity },
        { onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Request failed.") }
      );
    }
  }

  const pending = purchase.isPending || requestPurchase.isPending;
  const requestSent = !canPurchase && requestPurchase.isSuccess;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Zap size={18} className="text-amber" />
        <h4 className="text-sm font-semibold text-body-text">{product.name}</h4>
      </div>
      <p className="text-xs text-muted-text mb-3">
        {product.description} {unitCost} credits each.
        {canPurchase && (
          <>
            {" "}
            You have <span className="font-semibold text-body-text">{company?.bumpsAvailable ?? 0}</span> available.
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          className="w-20 bg-background border border-border/40 text-body-text rounded h-9 px-3 focus:outline-none focus:border-supplier-purple-start transition-colors"
        />
        <Button onClick={handleBuy} disabled={pending} className="h-9 !px-4 text-sm">
          {pending
            ? canPurchase
              ? "Buying…"
              : "Sending…"
            : canPurchase
              ? `Buy (${quantity * unitCost} credits)`
              : `Request ${quantity}`}
        </Button>
      </div>
      {!canPurchase && (
        <p className="text-xs text-muted-text mt-2">
          You don&apos;t have permission to spend company funds directly — this sends a request to your company admin.
        </p>
      )}
      {requestSent && <p className="text-xs text-success-green mt-2">Request sent — pending your company admin&apos;s approval.</p>}
      {error && <p className="text-xs text-error-red mt-2">{error}</p>}
    </Card>
  );
}

function PinCard({ product }: { product: BoostProduct }) {
  const canPurchase = useCanPurchaseBoosts();
  const { data: listings } = useSupplierListings();
  const purchase = usePurchasePin();
  const requestPurchase = useCreateCompanyBoostRequest();
  const [picker, setPicker] = useState<7 | 30 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestSentFor, setRequestSentFor] = useState<string | null>(null);

  const activeListings = (listings ?? []).filter((l) => l.isAvailable);
  const pending = purchase.isPending || requestPurchase.isPending;
  const durationPrices: Record<7 | 30, number> = { 7: product.pin7PriceCredits ?? 0, 30: product.pin30PriceCredits ?? 0 };

  function handlePin(listingId: string) {
    if (!picker) return;
    setError(null);
    if (canPurchase) {
      purchase.mutate(
        { listingId, durationDays: picker },
        {
          onSuccess: () => setPicker(null),
          onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Purchase failed."),
        }
      );
    } else {
      requestPurchase.mutate(
        { type: "pin", listingId, durationDays: picker },
        {
          onSuccess: () => {
            setRequestSentFor(listingId);
            setPicker(null);
          },
          onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Request failed."),
        }
      );
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <PinIcon size={18} className="text-amber" />
        <h4 className="text-sm font-semibold text-body-text">{product.name}</h4>
      </div>
      <p className="text-xs text-muted-text mb-3">{product.description}</p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setPicker(7)} className="h-9 !px-4 text-sm flex-1">
          7 days ({durationPrices[7]} credits)
        </Button>
        <Button variant="ghost" onClick={() => setPicker(30)} className="h-9 !px-4 text-sm flex-1">
          30 days ({durationPrices[30]} credits)
        </Button>
      </div>
      {!canPurchase && (
        <p className="text-xs text-muted-text mt-2">
          You don&apos;t have permission to spend company funds directly — this sends a request to your company admin.
        </p>
      )}
      {requestSentFor && <p className="text-xs text-success-green mt-2">Request sent — pending your company admin&apos;s approval.</p>}

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
                  disabled={pending}
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

// A builtinEffect "none" (admin-authored) product — a plain per-unit credit
// purchase with no automated inventory effect (see purchaseBoostProduct's
// own comment: the resulting CompanyTransaction row IS the sale record,
// nothing further to fulfill inside the app).
function CustomProductCard({ product }: { product: BoostProduct }) {
  const canPurchase = useCanPurchaseBoosts();
  const purchase = usePurchaseBoostProduct();
  const requestPurchase = useCreateCompanyBoostRequest();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const unitCost = product.priceCredits ?? 0;
  const Icon = ICON_MAP[product.iconName] ?? Star;

  function handleBuy() {
    setError(null);
    if (canPurchase) {
      purchase.mutate(
        { id: product.id, quantity },
        { onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Purchase failed.") }
      );
    } else {
      requestPurchase.mutate(
        { type: "product", boostProductId: product.id, quantity },
        { onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Request failed.") }
      );
    }
  }

  const pending = purchase.isPending || requestPurchase.isPending;
  const requestSent = !canPurchase && requestPurchase.isSuccess;
  const purchased = canPurchase && purchase.isSuccess;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className="text-amber" />
        <h4 className="text-sm font-semibold text-body-text">{product.name}</h4>
      </div>
      <p className="text-xs text-muted-text mb-3">
        {product.description} {unitCost} credits each.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          className="w-20 bg-background border border-border/40 text-body-text rounded h-9 px-3 focus:outline-none focus:border-supplier-purple-start transition-colors"
        />
        <Button onClick={handleBuy} disabled={pending} className="h-9 !px-4 text-sm">
          {pending
            ? canPurchase
              ? "Buying…"
              : "Sending…"
            : canPurchase
              ? `Buy (${quantity * unitCost} credits)`
              : `Request ${quantity}`}
        </Button>
      </div>
      {!canPurchase && (
        <p className="text-xs text-muted-text mt-2">
          You don&apos;t have permission to spend company funds directly — this sends a request to your company admin.
        </p>
      )}
      {requestSent && <p className="text-xs text-success-green mt-2">Request sent — pending your company admin&apos;s approval.</p>}
      {purchased && <p className="text-xs text-success-green mt-2">Purchased.</p>}
      {error && <p className="text-xs text-error-red mt-2">{error}</p>}
    </Card>
  );
}

export default function ListingBoostCatalogueCard() {
  const { data: products, isLoading, isError } = useSupplierBoostProducts();

  return (
    <div>
      <h3 className="text-base font-semibold text-body-text mb-1">Boost Your Listings</h3>
      <p className="text-sm text-muted-text mb-3">Use these to enhance your utilization rate!</p>

      {isLoading ? (
        <p className="text-sm text-muted-text text-center py-8">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-error-red text-center py-8">Failed to load the catalogue.</p>
      ) : !products || products.length === 0 ? (
        <p className="text-sm text-muted-text text-center py-8">No boost products available right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((product) => {
            if (product.builtinEffect === "bump") return <BumpsCard key={product.id} product={product} />;
            if (product.builtinEffect === "pin") return <PinCard key={product.id} product={product} />;
            return <CustomProductCard key={product.id} product={product} />;
          })}
        </div>
      )}
    </div>
  );
}
