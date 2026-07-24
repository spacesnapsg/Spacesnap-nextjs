import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam, serializeListing } from "@/lib/listings";
import { getListingRatingAggregates } from "@/lib/ratings";
import { getEffectiveCompanyPricing } from "@/lib/pricing";

// Public single-listing view + required certs. Mirrors old
// ListingController@show.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = parseBigIntParam(id);
  if (listingId === null) return notFoundResponse("Listing not found.");

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { requiredCertificates: { include: { certificate: true } }, company: { select: { name: true } } },
  });
  if (!listing) return notFoundResponse("Listing not found.");

  const [ratingAggregates, pricing] = await Promise.all([
    getListingRatingAggregates([listing.id]),
    getEffectiveCompanyPricing(listing.companyId),
  ]);

  return NextResponse.json({ listing: serializeListing(listing, ratingAggregates.get(listing.id.toString()), pricing) });
}
