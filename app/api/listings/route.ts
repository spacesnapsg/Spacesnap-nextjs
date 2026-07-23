import { NextRequest, NextResponse } from "next/server";
import { ListingType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeListing } from "@/lib/listings";
import { getListingRatingAggregates } from "@/lib/ratings";

const LISTING_TYPES = new Set<string>(Object.values(ListingType));

// Public marketplace browse — filters: type, location, isAvailable, search.
// Mirrors old ListingController@index (see CODEBASEAPI_SUMMARY.md §3).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const location = searchParams.get("location");
  const search = searchParams.get("search");
  const isAvailableParam = searchParams.get("isAvailable");

  if (type !== null && !LISTING_TYPES.has(type)) {
    return NextResponse.json(
      {
        message: "The given data was invalid.",
        errors: { type: ["type must be one of space, equipment, consumables."] },
      },
      { status: 422 }
    );
  }

  // Lazy expiry, same idiom as getAvailableCreditBalance's credit-hold
  // expiry (no scheduled-job infra in this codebase) — clears any pin whose
  // window has passed before the main query runs, so an expired pin can
  // never sort into the Pinned tier below.
  await prisma.listing.updateMany({
    where: { pinnedUntil: { lt: new Date() } },
    data: { pinnedAt: null, pinnedUntil: null },
  });

  const listings = await prisma.listing.findMany({
    where: {
      ...(type ? { type: type as ListingType } : {}),
      ...(location ? { location: { contains: location, mode: "insensitive" } } : {}),
      ...(isAvailableParam !== null ? { isAvailable: isAvailableParam !== "false" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { location: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { requiredCertificates: { include: { certificate: true } }, company: { select: { name: true } } },
    // Sprint 6.12 — was `{ id: "asc" }` (oldest-first, not actually
    // date-based at all, confirmed by reading this route before assuming
    // otherwise). Pinned listings (non-null pinnedAt, already lazily
    // cleared of expired ones above) sort first, ordered by pin recency;
    // everything else falls back to boostedAt, bumped by activateBump
    // (lib/listings.ts). The frontend still renders pinned listings in
    // their own separate "Pinned" section rather than relying on this
    // order alone — see the marketplace page's own comment.
    orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { boostedAt: "desc" }],
  });

  const ratingAggregates = await getListingRatingAggregates(listings.map((l) => l.id));

  return NextResponse.json({
    listings: listings.map((listing) => serializeListing(listing, ratingAggregates.get(listing.id.toString()))),
  });
}
