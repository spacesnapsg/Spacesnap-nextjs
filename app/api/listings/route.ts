import { NextRequest, NextResponse } from "next/server";
import { ListingType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeListing } from "@/lib/listings";

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
    include: { requiredCertificates: { include: { certificate: true } } },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ listings: listings.map(serializeListing) });
}
