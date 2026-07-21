import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import {
  assertPricingMatchesType,
  parseListingFields,
  parseRequiredCertificateIds,
  resolvePricing,
  serializeListing,
} from "@/lib/listings";
import { getListingRatingAggregates } from "@/lib/ratings";

// Company-scoped listing management. Mirrors old SupplierListingController.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const listings = await prisma.listing.findMany({
    where: { companyId: auth.companyId },
    include: { requiredCertificates: { include: { certificate: true } } },
    orderBy: { id: "asc" },
  });

  const ratingAggregates = await getListingRatingAggregates(listings.map((l) => l.id));

  return NextResponse.json({
    listings: listings.map((listing) => serializeListing(listing, ratingAggregates.get(listing.id.toString()))),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseListingFields(body, { partial: false });
    const effective = resolvePricing(fields, null);
    assertPricingMatchesType(effective);
    const requiredCertificateIds = await parseRequiredCertificateIds(
      (body as Record<string, unknown>).requiredCertificateIds
    );

    const listing = await prisma.listing.create({
      data: {
        companyId: auth.companyId,
        name: fields.name!,
        type: effective.type,
        location: fields.location ?? null,
        description: fields.description ?? null,
        imageUrl: fields.imageUrl ?? null,
        amenities: fields.amenities ?? [],
        isAvailable: fields.isAvailable ?? true,
        requireApproval: fields.requireApproval ?? false,
        priceDay: effective.priceDay,
        priceWeek: effective.priceWeek,
        priceMonth: effective.priceMonth,
        pricePerUnit: effective.pricePerUnit,
        stockQuantity: effective.stockQuantity,
        packSize: effective.packSize,
        ...(requiredCertificateIds && requiredCertificateIds.length > 0
          ? { requiredCertificates: { create: requiredCertificateIds.map((certificateId) => ({ certificateId })) } }
          : {}),
      },
      include: { requiredCertificates: { include: { certificate: true } } },
    });

    return NextResponse.json({ listing: serializeListing(listing) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
