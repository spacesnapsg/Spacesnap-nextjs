import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, forbiddenResponse, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  assertPricingMatchesType,
  parseBigIntParam,
  parseListingFields,
  parseRequiredCertificateIds,
  resolvePricing,
  serializeListing,
} from "@/lib/listings";

// Mirrors old SupplierListingController::update + ListingPolicy::update
// (company ownership check).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const listingId = parseBigIntParam(id);
  if (listingId === null) return notFoundResponse("Listing not found.");

  const existing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!existing) return notFoundResponse("Listing not found.");
  if (existing.companyId !== auth.companyId) {
    return forbiddenResponse("You do not have access to this listing.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  try {
    const fields = parseListingFields(body, { partial: true });
    const effective = resolvePricing(fields, existing);
    assertPricingMatchesType(effective);
    const requiredCertificateIds = await parseRequiredCertificateIds(
      (body as Record<string, unknown>).requiredCertificateIds
    );

    const updated = await prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listingId },
        data: {
          ...(fields.name !== undefined ? { name: fields.name } : {}),
          ...(fields.location !== undefined ? { location: fields.location } : {}),
          ...(fields.description !== undefined ? { description: fields.description } : {}),
          ...(fields.imageUrl !== undefined ? { imageUrl: fields.imageUrl } : {}),
          ...(fields.amenities !== undefined ? { amenities: fields.amenities } : {}),
          ...(fields.isAvailable !== undefined ? { isAvailable: fields.isAvailable } : {}),
          ...(fields.requireApproval !== undefined ? { requireApproval: fields.requireApproval } : {}),
          type: effective.type,
          priceDay: effective.priceDay,
          priceWeek: effective.priceWeek,
          priceMonth: effective.priceMonth,
          pricePerUnit: effective.pricePerUnit,
          stockQuantity: effective.stockQuantity,
          packSize: effective.packSize,
        },
      });

      if (requiredCertificateIds !== undefined) {
        await tx.listingRequiredCertificate.deleteMany({ where: { listingId } });
        if (requiredCertificateIds.length > 0) {
          await tx.listingRequiredCertificate.createMany({
            data: requiredCertificateIds.map((certificateId) => ({ listingId, certificateId })),
          });
        }
      }

      return tx.listing.findUniqueOrThrow({
        where: { id: listingId },
        include: { requiredCertificates: { include: { certificate: true } } },
      });
    });

    return NextResponse.json({ listing: serializeListing(updated) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}
