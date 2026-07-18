import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-auth";
import { forbiddenResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBigIntParam, serializeListing } from "@/lib/listings";

// Flips is_available. Mirrors old SupplierListingController::toggleAvailability
// (the Inventory page's "Mark Available/Unavailable" card button).
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { isAvailable: !existing.isAvailable },
    include: { requiredCertificates: { include: { certificate: true } } },
  });

  return NextResponse.json({ listing: serializeListing(updated) });
}
